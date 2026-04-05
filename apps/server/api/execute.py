import logging
import os

import modal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.step_types import EditStep
from lib.supabase import get_supabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_local_supabase() -> bool:
    url = os.environ.get("SUPABASE_URL", "")
    return "127.0.0.1" in url or "localhost" in url


class ExecuteRequest(BaseModel):
    project_id: str
    approved_steps: list[EditStep]


class ExecuteResponse(BaseModel):
    success: bool
    processed_url: str
    actual_duration: float | None = None
    total_removed: float | None = None


@router.post("/execute", response_model=ExecuteResponse)
async def execute_edits(req: ExecuteRequest):
    """Spawn the rendering pipeline on Modal and wait for the result."""
    supabase = get_supabase()

    # Fetch project to get raw_url and user_id
    result = supabase.table("projects").select("raw_url, user_id, id").eq(
        "id", req.project_id
    ).single().execute()
    project = result.data
    if not project or not project.get("raw_url"):
        raise HTTPException(status_code=404, detail="Project not found")

    raw_url = project["raw_url"]
    user_id = project["user_id"]

    # Serialise steps as plain dicts for Modal
    steps_payload = []
    for s in req.approved_steps:
        step_dict = {
            "id": s.id,
            "type": s.type,
            "reason": s.reason,
            "start_time": s.start_time,
            "end_time": s.end_time,
        }
        if s.type == "broll":
            step_dict["clip_url"] = s.clip_url
            step_dict["clip_id"] = s.clip_id
            step_dict["query"] = s.query
        steps_payload.append(step_dict)

    try:
        if _is_local_supabase():
            # Local Supabase is unreachable from Modal's remote containers.
            # Run the render function in-process instead.
            from modal_app.render import run_render
            logger.info("Running render locally (local Supabase detected)")
            render_result = run_render.local(
                req.project_id, steps_payload, raw_url, user_id,
            )
        else:
            run_render = modal.Function.from_name("somvo", "run_render")
            render_result = await run_render.remote.aio(
                req.project_id, steps_payload, raw_url, user_id,
            )
    except Exception as exc:
        logger.exception("Modal render failed for project %s", req.project_id)
        raise HTTPException(status_code=500, detail=str(exc))

    return ExecuteResponse(
        success=render_result["success"],
        processed_url=render_result["processed_url"],
        actual_duration=render_result.get("actual_duration"),
        total_removed=render_result.get("total_removed"),
    )
