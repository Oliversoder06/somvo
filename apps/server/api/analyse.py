import json
import logging
import os
import shutil
import tempfile
from typing import AsyncGenerator

import ffmpeg as ffmpeg_lib
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lib.supabase import get_supabase
from pipelines import get_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)


class AnalyseRequest(BaseModel):
    project_id: str
    prompt: str
    pipeline_version: str = "v1"


async def analysis_stream(
    project_id: str, prompt: str, pipeline_version: str = "v1"
) -> AsyncGenerator[str, None]:
    supabase = get_supabase()
    pipeline = get_pipeline(pipeline_version)

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

        # Run the selected pipeline — it yields status messages + a final result
        steps = []
        pipeline_log = None
        transcript = None

        async for event in pipeline.analyse(video_path, prompt, duration):
            if event["type"] == "status":
                yield f"data: {json.dumps({'type': 'status', 'message': event['message']})}\n\n"
            elif event["type"] == "result":
                steps = event["steps"]
                pipeline_log = event["log"]
                transcript = event["transcript"]

        # Stream each cut to the client
        for step in steps:
            step_dict = {
                "id": step.id,
                "type": step.type,
                "reason": step.reason,
                "startTime": step.start_time,
                "endTime": step.end_time,
                "confidence": step.confidence,
                "status": "pending",
            }
            yield f"data: {json.dumps({'type': 'cut', 'step': step_dict})}\n\n"

        # Stream pipeline log summary
        if pipeline_log:
            log_summary = pipeline_log.summary()
            yield f"data: {json.dumps({'type': 'log_summary', 'summary': log_summary})}\n\n"

        # Store transcript in Supabase
        if transcript:
            try:
                supabase.table("transcripts").upsert(
                    {
                        "project_id": project_id,
                        "words": transcript["words"],
                        "srt": transcript["srt"],
                    },
                    on_conflict="project_id",
                ).execute()
            except Exception as db_err:
                logger.error("Failed to upsert transcript for project %s: %s", project_id, db_err)
                yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to save transcript: {db_err}'})}\n\n"
                return

        # Store edit steps + pipeline log in Supabase
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
        try:
            supabase.table("edit_steps").upsert(
                {
                    "project_id": project_id,
                    "steps": steps_payload,
                    "pipeline_log": pipeline_log.summary() if pipeline_log else {},
                },
                on_conflict="project_id",
            ).execute()
        except Exception as db_err:
            logger.error("Failed to upsert edit_steps for project %s: %s", project_id, db_err)
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to save edit steps: {db_err}'})}\n\n"
            return

        # Update project status
        try:
            supabase.table("projects").update(
                {
                    "status": "ready",
                    "duration_seconds": int(duration),
                }
            ).eq("id", project_id).execute()
        except Exception as db_err:
            logger.error("Failed to update project status for %s: %s", project_id, db_err)

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
        analysis_stream(req.project_id, req.prompt, req.pipeline_version),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
