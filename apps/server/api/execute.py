import os
import shutil
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.step_types import EditStep
from lib.supabase import get_supabase
from modal_app.ffmpeg_utils import (
    burn_captions,
    apply_watermark,
    cap_resolution,
    execute_edit_steps,
)

router = APIRouter()


class ExecuteRequest(BaseModel):
    project_id: str
    approved_steps: list[EditStep]


class ExecuteResponse(BaseModel):
    success: bool
    processed_url: str


@router.post("/execute", response_model=ExecuteResponse)
async def execute_edits(req: ExecuteRequest):
    """Apply approved edit steps and produce the final processed video."""
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

    work_dir = tempfile.mkdtemp(prefix=f"somvo_{req.project_id}_")
    video_path = os.path.join(work_dir, "original.mp4")

    try:
        # Download raw video
        file_bytes = supabase.storage.from_("raw").download(raw_url)
        with open(video_path, "wb") as f:
            f.write(file_bytes)

        current_path = video_path

        # Apply all cut / shorten / split steps via the smart executor
        edit_steps = [
            {
                "type": s.type,
                "start_time": s.start_time,
                "end_time": s.end_time,
            }
            for s in req.approved_steps
            if s.type in ("cut_silence", "cut_filler", "shorten", "split", "trim")
        ]

        clip_paths: list[str] = [video_path]
        if edit_steps:
            clip_paths = execute_edit_steps(video_path, edit_steps, work_dir)
            current_path = clip_paths[0]

        # Burn captions if any caption steps approved
        caption_steps = [s for s in req.approved_steps if s.type == "caption"]
        if caption_steps:
            # Fetch SRT from transcripts table
            transcript_result = supabase.table("transcripts").select("srt").eq(
                "project_id", req.project_id
            ).single().execute()
            srt_content = transcript_result.data.get("srt", "") if transcript_result.data else ""
            if srt_content:
                srt_path = os.path.join(work_dir, "captions.srt")
                with open(srt_path, "w") as f:
                    f.write(srt_content)
                caption_output = os.path.join(work_dir, "captioned.mp4")
                burn_captions(current_path, srt_path, caption_output)
                current_path = caption_output

        # Check user plan for free tier restrictions
        user_result = supabase.table("users").select("plan").eq(
            "id", user_id
        ).single().execute()
        plan = user_result.data.get("plan", "free") if user_result.data else "free"

        if plan == "free":
            # Apply watermark
            watermark_path = os.path.join(
                os.path.dirname(__file__), "..", "public", "watermark.png"
            )
            if os.path.exists(watermark_path):
                wm_output = os.path.join(work_dir, "watermarked.mp4")
                apply_watermark(current_path, watermark_path, wm_output)
                current_path = wm_output

            # Cap resolution to 720p
            capped_output = os.path.join(work_dir, "capped.mp4")
            cap_resolution(current_path, capped_output, max_height=720)
            current_path = capped_output

        # Upload processed video(s) to Supabase Storage
        # If multiple clips from split, upload each; primary is clip 0
        storage_path = f"{user_id}/{req.project_id}/output.mp4"
        if len(clip_paths) > 1:
            for i, cp in enumerate(clip_paths):
                clip_storage = f"{user_id}/{req.project_id}/clip_{i}.mp4"
                with open(cp, "rb") as f:
                    supabase.storage.from_("processed").upload(
                        clip_storage,
                        f.read(),
                        file_options={"content-type": "video/mp4", "upsert": "true"},
                    )
            storage_path = f"{user_id}/{req.project_id}/clip_0.mp4"
        else:
            with open(current_path, "rb") as f:
                supabase.storage.from_("processed").upload(
                    storage_path,
                    f.read(),
                    file_options={"content-type": "video/mp4", "upsert": "true"},
                )

        # Update project status
        supabase.table("projects").update({
            "status": "done",
            "processed_url": storage_path,
        }).eq("id", req.project_id).execute()

        return ExecuteResponse(success=True, processed_url=storage_path)

    except Exception as exc:
        # Mark project as failed on error
        try:
            supabase.table("projects").update({
                "status": "failed",
            }).eq("id", req.project_id).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(exc))

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
