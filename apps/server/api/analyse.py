import json
import os
import shutil
import tempfile
from typing import AsyncGenerator

import ffmpeg as ffmpeg_lib
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lib.cut_list import generate_cut_list
from lib.silence_detection import derive_silence_from_words
from lib.supabase import get_supabase
from lib.transcribe_openai import transcribe_video

router = APIRouter()


class AnalyseRequest(BaseModel):
    project_id: str
    prompt: str


async def analysis_stream(project_id: str, prompt: str) -> AsyncGenerator[str, None]:
    supabase = get_supabase()

    # Fetch project
    project = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .single()
        .execute()
    )
    raw_url = project.data["raw_url"]

    work_dir = tempfile.mkdtemp(prefix=f"somvo_{project_id}_")
    video_path = os.path.join(work_dir, "original.mp4")

    try:
        yield f"data: {json.dumps({'type': 'status', 'message': 'Downloading video...'})}\n\n"

        # Download raw video
        file_bytes = supabase.storage.from_("raw").download(raw_url)
        with open(video_path, "wb") as f:
            f.write(file_bytes)

        # Get video duration
        probe = ffmpeg_lib.probe(video_path)
        duration = float(probe["format"]["duration"])

        yield f"data: {json.dumps({'type': 'status', 'message': 'Transcribing audio...'})}\n\n"

        # Transcribe
        transcript = transcribe_video(video_path)

        word_count = len(transcript["words"])
        yield f"data: {json.dumps({'type': 'status', 'message': f'Found {word_count} words'})}\n\n"

        # Detect silence
        silences = derive_silence_from_words(transcript["words"])

        yield f"data: {json.dumps({'type': 'status', 'message': f'Detected {len(silences)} silence regions'})}\n\n"

        # Generate cut list
        steps = generate_cut_list(silences, transcript, duration)

        yield f"data: {json.dumps({'type': 'status', 'message': 'Proposing cuts...'})}\n\n"

        # Stream each cut as it's generated
        for step in steps:
            step_dict = {
                "id": step.id,
                "type": step.type,
                "reason": step.reason,
                "startTime": step.start_time,
                "endTime": step.end_time,
                "status": "pending",
            }
            yield f"data: {json.dumps({'type': 'cut', 'step': step_dict})}\n\n"

        # Store transcript in Supabase
        supabase.table("transcripts").upsert(
            {
                "project_id": project_id,
                "words": transcript["words"],
                "srt": transcript["srt"],
            },
            on_conflict="project_id",
        ).execute()

        # Store edit steps in Supabase
        steps_payload = [
            {
                "id": s.id,
                "type": s.type,
                "reason": s.reason,
                "startTime": s.start_time,
                "endTime": s.end_time,
                "status": "pending",
            }
            for s in steps
        ]
        supabase.table("edit_steps").insert(
            {
                "project_id": project_id,
                "steps": steps_payload,
            }
        ).execute()

        # Update project status
        supabase.table("projects").update(
            {
                "status": "ready",
                "duration_seconds": int(duration),
            }
        ).eq("id", project_id).execute()

        yield f"data: {json.dumps({'type': 'done', 'step_count': len(steps)})}\n\n"

    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        try:
            supabase.table("projects").update(
                {"status": "failed"}
            ).eq("id", project_id).execute()
        except Exception:
            pass

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/analyse")
async def analyse_video(req: AnalyseRequest):
    return StreamingResponse(
        analysis_stream(req.project_id, req.prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
