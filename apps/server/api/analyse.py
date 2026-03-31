import json
import logging
import os
import shutil
import tempfile
from typing import AsyncGenerator
from uuid import uuid4

import ffmpeg as ffmpeg_lib
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lib.intent_router import classify_intent
from lib.step_types import EditStep
from lib.supabase import get_supabase
from lib.transcribe_openai import transcribe_video
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

    # ---- Intent classification ----
    yield f"data: {json.dumps({'type': 'status', 'message': 'Understanding your request...'})}\n\n"

    classification = classify_intent(prompt)

    if not classification["supported"]:
        logger.info("[analyse] Unsupported intent — returning info to user: %r", classification["message"])
        yield f"data: {json.dumps({'type': 'info', 'message': classification['message']})}\n\n"
        return

    if classification["message"]:
        yield f"data: {json.dumps({'type': 'status', 'message': classification['message']})}\n\n"

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

        intent = classification.get("intent", "clean_edit")
        steps = []
        pipeline_log = None
        transcript = None

        logger.info("[analyse] Routing to intent=%r  duration=%.1fs", intent, duration)

        # ---- Route based on classified intent ----
        if intent == "captions":
            logger.info("[analyse] → Captions branch: transcribe only, no silence detection")
            # Captions only need a transcript + a single caption step
            yield f"data: {json.dumps({'type': 'status', 'message': 'Transcribing audio...'})}\n\n"
            transcript = transcribe_video(video_path)
            word_count = len(transcript["words"])
            yield f"data: {json.dumps({'type': 'status', 'message': f'Found {word_count} words'})}\n\n"

            yield f"data: {json.dumps({'type': 'status', 'message': 'Preparing captions...'})}\n\n"
            steps = [
                EditStep(
                    id=str(uuid4()),
                    type="caption",
                    reason="Burn captions into the video",
                    start_time=0.0,
                    end_time=duration,
                    confidence=10,
                ),
            ]
        else:
            # Default: run the selected pipeline (v1 silence, etc.)
            logger.info("[analyse] → Pipeline branch: running %s", pipeline_version)
            async for event in pipeline.analyse(video_path, prompt, duration):
                if event["type"] == "status":
                    yield f"data: {json.dumps({'type': 'status', 'message': event['message']})}\n\n"
                elif event["type"] == "result":
                    steps = event["steps"]
                    pipeline_log = event["log"]
                    transcript = event["transcript"]

        logger.info("[analyse] Processing complete — %d steps generated", len(steps))
        for s in steps:
            logger.debug("[analyse]   step: type=%s  range=%.2f-%.2f  reason=%r", s.type, s.start_time, s.end_time, s.reason)

        # Stream each step to the client
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
            # Caption steps use their own event type so the frontend
            # doesn't treat them as video cuts
            event_type = "caption" if step.type == "caption" else "cut"
            yield f"data: {json.dumps({'type': event_type, 'step': step_dict})}\n\n"

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

                # Tell the frontend to load captions from the saved transcript
                if intent == "captions":
                    yield f"data: {json.dumps({'type': 'captions_ready'})}\n\n"

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

        logger.info("[analyse] ✓ Done — project=%s intent=%s step_count=%d", project_id, intent, len(steps))
        yield f"data: {json.dumps({'type': 'done', 'step_count': len(steps)})}\n\n"

    except Exception as exc:
        logger.exception("[analyse] FAILED project=%s intent=%r error=%s", project_id, classification.get("intent"), exc)
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
