import os

import modal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.supabase import get_supabase

router = APIRouter()


class ProcessRequest(BaseModel):
    project_id: str
    raw_url: str


class ProcessResponse(BaseModel):
    success: bool
    project_id: str


@router.post("/process", response_model=ProcessResponse)
async def process_video(req: ProcessRequest):
    """Kick off the Modal processing pipeline (non-blocking)."""
    supabase = get_supabase()

    # Update project status to 'processing'
    supabase.table("projects").update({
        "status": "processing",
    }).eq("id", req.project_id).execute()

    # Look up the deployed Modal function by name and spawn it (non-blocking)
    run_pipeline = modal.Function.from_name("somvo", "run_pipeline")
    await run_pipeline.spawn.aio(req.project_id, req.raw_url)

    return ProcessResponse(success=True, project_id=req.project_id)
