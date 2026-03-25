import os
import asyncio

from modal_app.app import app, image, model_cache, secrets
from modal_app.transcribe import transcribe
from modal_app.vad import detect_silence


@app.function(
    image=image,
    gpu="T4",
    volumes={"/cache": model_cache},
    secrets=secrets,
    timeout=900,
)
async def run_pipeline(project_id: str, raw_storage_path: str) -> dict:
    """
    Full processing pipeline for a single project.

    1. Download video from Supabase Storage
    2. Extract audio with FFmpeg
    3. Run VAD and WhisperX in parallel
    4. Generate cut list
    5. Store transcript + edit_steps in Supabase
    6. Update project status to 'ready'
    7. Return summary
    """
    import ffmpeg as ffmpeg_lib
    from lib.cut_list import generate_cut_list
    from lib.supabase import get_supabase
    from modal_app.ffmpeg_utils import extract_audio

    supabase = get_supabase()
    work_dir = f"/tmp/{project_id}"
    os.makedirs(work_dir, exist_ok=True)
    video_path = os.path.join(work_dir, "original.mp4")
    audio_path = os.path.join(work_dir, "audio.wav")

    try:
        # 1. Download the raw video from Supabase Storage
        file_bytes = supabase.storage.from_("raw").download(raw_storage_path)
        with open(video_path, "wb") as f:
            f.write(file_bytes)

        # Get video duration
        probe = ffmpeg_lib.probe(video_path)
        duration = float(probe["format"]["duration"])

        # 2. Extract audio
        extract_audio(video_path, audio_path)

        # 3. Run VAD and WhisperX in parallel (local calls — same container, shared filesystem)
        silence_segments, transcript = await asyncio.gather(
            asyncio.to_thread(detect_silence.local, audio_path),
            asyncio.to_thread(transcribe.local, audio_path),
        )

        # 4. Generate cut list
        steps = generate_cut_list(silence_segments, transcript, duration)

        # 5. Store transcript in Supabase
        supabase.table("transcripts").insert({
            "project_id": project_id,
            "words": transcript["words"],
            "srt": transcript["srt"],
        }).execute()

        # 6. Store edit steps in Supabase
        # Convert steps to camelCase dicts for the frontend
        steps_payload = [
            {
                "id": s.id,
                "type": s.type,
                "reason": s.reason,
                "startTime": s.start_time,
                "endTime": s.end_time,
            }
            for s in steps
        ]
        supabase.table("edit_steps").insert({
            "project_id": project_id,
            "steps": steps_payload,
        }).execute()

        # 7. Update project status to 'ready'
        supabase.table("projects").update({
            "status": "ready",
            "duration_seconds": int(duration),
        }).eq("id", project_id).execute()

        return {
            "project_id": project_id,
            "step_count": len(steps),
            "duration": duration,
        }

    except Exception as exc:
        # On failure, mark project as failed
        try:
            supabase.table("projects").update({
                "status": "failed",
            }).eq("id", project_id).execute()
        except Exception:
            pass
        raise exc

    finally:
        # Clean up temp files
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)
