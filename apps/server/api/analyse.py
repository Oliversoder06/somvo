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

from lib.step_types import EditStep
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

        logger.info("[analyse] Starting pipeline=%s  duration=%.1fs  prompt=%r",
                    pipeline_version, duration, prompt[:80])

        # ── Route everything through the pipeline ───────────────────────────
        # The pipeline calls lib.intent.parse_intent(prompt) internally and
        # gates every feature on the returned EditIntent flags.  All intent
        # classification, status messages, and unsupported-request warnings are
        # handled inside the pipeline — analyse.py has no routing logic of its own.
        steps: list[EditStep] = []
        pipeline_log = None
        transcript = None

        async for event in pipeline.analyse(video_path, prompt, duration):
            if event["type"] == "status":
                yield f"data: {json.dumps({'type': 'status', 'message': event['message']})}\n\n"
            elif event["type"] == "result":
                steps = event["steps"]
                pipeline_log = event["log"]
                transcript = event["transcript"]

        logger.info("[analyse] Pipeline complete — %d steps", len(steps))
        for s in steps:
            logger.debug("[analyse]   step: type=%s  range=%.2f-%.2f  reason=%r",
                         s.type, s.start_time, s.end_time, s.reason)

        # ── Stream each step to the frontend ────────────────────────────────
        # Caption steps use their own event type so the frontend doesn't treat
        # them as video cuts in the timeline. B-roll steps get their own type too.
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
            if step.type == "broll":
                step_dict["query"] = step.query
                step_dict["clipUrl"] = step.clip_url
                step_dict["clipId"] = step.clip_id
                step_dict["thumbnailUrl"] = step.thumbnail_url
                step_dict["label"] = step.label
                step_dict["alternatives"] = step.alternatives or []
                event_type = "broll"
            elif step.type == "caption":
                event_type = "caption"
            else:
                event_type = "cut"
            yield f"data: {json.dumps({'type': event_type, 'step': step_dict})}\n\n"

        # ── Stream pipeline log summary ──────────────────────────────────────
        if pipeline_log:
            log_summary = pipeline_log.summary()
            yield f"data: {json.dumps({'type': 'log_summary', 'summary': log_summary})}\n\n"

        # ── Persist transcript ───────────────────────────────────────────────
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
                logger.info("[analyse] Transcript saved (%d words)", len(transcript["words"]))

                # Only tell the frontend to enable captions if caption steps were requested
                has_caption_steps = any(s.type == "caption" for s in steps)
                if has_caption_steps:
                    yield f"data: {json.dumps({'type': 'captions_ready', 'word_count': len(transcript['words'])})}\n\n"

            except Exception as exc:
                logger.error("[analyse] Failed to save transcript: %s", exc)
                yield f"data: {json.dumps({'type': 'error', 'message': 'Transcript save failed — captions may not display correctly.'})}\n\n"

        # ── Persist edit steps ───────────────────────────────────────────────
        try:
            steps_payload = []
            for s in steps:
                step_data = {
                    "id": s.id,
                    "type": s.type,
                    "reason": s.reason,
                    "startTime": s.start_time,
                    "endTime": s.end_time,
                    "confidence": s.confidence,
                    "status": "pending",
                }
                if s.type == "broll":
                    step_data["query"] = s.query
                    step_data["clipUrl"] = s.clip_url
                    step_data["clipId"] = s.clip_id
                    step_data["thumbnailUrl"] = s.thumbnail_url
                    step_data["label"] = s.label
                    step_data["alternatives"] = s.alternatives or []
                steps_payload.append(step_data)
            supabase.table("edit_steps").upsert(
                {
                    "project_id": project_id,
                    "steps": steps_payload,
                    "pipeline_log": pipeline_log.summary() if pipeline_log else {},
                },
                on_conflict="project_id",
            ).execute()
            logger.info("[analyse] edit_steps saved (%d steps)", len(steps))
        except Exception as exc:
            logger.error("[analyse] Failed to save edit_steps: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to save edit steps to database.'})}\n\n"

        # ── Mark project as analysed ─────────────────────────────────────────
        try:
            supabase.table("projects").update(
                {"status": "analysed", "pipeline_version": pipeline_version}
            ).eq("id", project_id).execute()
        except Exception as exc:
            logger.error("[analyse] Failed to update project status: %s", exc)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as exc:
        logger.exception("[analyse] Unhandled error for project %s: %s", project_id, exc)
        yield f"data: {json.dumps({'type': 'error', 'message': f'Analysis failed: {exc}'})}\n\n"
        raise

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/analyse")
async def analyse(req: AnalyseRequest) -> StreamingResponse:
    return StreamingResponse(
        analysis_stream(req.project_id, req.prompt, req.pipeline_version),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
