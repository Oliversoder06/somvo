import os

from modal_app.app import app, image, model_cache, secrets


@app.function(
    image=image,
    volumes={"/cache": model_cache},
    secrets=secrets,
    timeout=600,
)
async def run_pipeline(project_id: str, raw_storage_path: str) -> dict:
    """
    Full processing pipeline for a single project.

    1. Download video from Supabase Storage
    2. Call transcribe_video() from lib/transcribe_openai.py
    3. Call derive_silence_from_words() from lib/silence_detection.py
    4. Generate cut list
    5. Store transcript + edit_steps in Supabase
    6. Update project status to 'ready'
    7. Return summary
    """
    import shutil

    import ffmpeg as ffmpeg_lib

    from lib.cut_list import generate_cut_list
    from lib.silence_detection import detect_silence_combined
    from lib.supabase import get_supabase
    from lib.transcribe_openai import transcribe_video

    supabase = get_supabase()
    work_dir = f"/tmp/{project_id}"
    os.makedirs(work_dir, exist_ok=True)
    video_path = os.path.join(work_dir, "original.mp4")

    try:
        # 1. Download the raw video from Supabase Storage
        file_bytes = supabase.storage.from_("raw").download(raw_storage_path)
        with open(video_path, "wb") as f:
            f.write(file_bytes)

        # Get video duration
        probe = ffmpeg_lib.probe(video_path)
        duration = float(probe["format"]["duration"])

        # 2. Transcribe using OpenAI Whisper API
        transcript = transcribe_video(video_path)

        # 3. Cross-validate silence using transcript gaps + audio energy
        silences, audio_silences = detect_silence_combined(video_path, transcript["words"])

        # 4. Generate cut list
        steps, pipeline_log = generate_cut_list(
            silences, transcript, duration, audio_silences=audio_silences,
        )

        # 5. Store transcript in Supabase
        supabase.table("transcripts").insert(
            {
                "project_id": project_id,
                "words": transcript["words"],
                "srt": transcript["srt"],
            }
        ).execute()

        # 6. Store edit steps + pipeline log in Supabase
        steps_payload = [
            {
                "id": s.id,
                "type": s.type,
                "reason": s.reason,
                "startTime": s.start_time,
                "endTime": s.end_time,
                "confidence": s.confidence,
                "status": "pending",
            }
            for s in steps
        ]
        supabase.table("edit_steps").insert(
            {
                "project_id": project_id,
                "steps": steps_payload,
                "pipeline_log": pipeline_log.summary(),
            }
        ).execute()

        # 7. Update project status to 'ready'
        supabase.table("projects").update(
            {
                "status": "ready",
                "duration_seconds": int(duration),
            }
        ).eq("id", project_id).execute()

        return {
            "project_id": project_id,
            "step_count": len(steps),
            "duration": duration,
        }

    except Exception as exc:
        try:
            supabase.table("projects").update(
                {
                    "status": "failed",
                }
            ).eq("id", project_id).execute()
        except Exception:
            pass
        raise exc

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
