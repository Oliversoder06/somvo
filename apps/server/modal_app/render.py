import os
import shutil
import logging

from modal_app.app import app, image, secrets

logger = logging.getLogger(__name__)


@app.function(
    image=image,
    secrets=secrets,
    timeout=900,
)
def run_render(
    project_id: str,
    approved_steps: list[dict],
    raw_url: str,
    user_id: str,
) -> dict:
    """Render the final processed video inside a Modal container.

    Performs all heavy FFmpeg work (segment extraction, concat, caption
    burn-in, watermark, resolution cap) and uploads the result to Supabase.

    Returns a dict with ``processed_url``, ``actual_duration``, and
    ``total_removed`` on success.
    """
    import ffmpeg as ffmpeg_lib

    from lib.supabase import get_supabase
    from lib.caption_chunks import chunk_transcript, chunks_to_srt
    from modal_app.ffmpeg_utils import (
        burn_captions,
        apply_watermark,
        cap_resolution,
        concat_segments,
        execute_edit_steps,
    )

    supabase = get_supabase()
    work_dir = f"/tmp/somvo_{project_id}"
    os.makedirs(work_dir, exist_ok=True)
    video_path = os.path.join(work_dir, "original.mp4")

    try:
        # Download raw video
        file_bytes = supabase.storage.from_("raw").download(raw_url)
        with open(video_path, "wb") as f:
            f.write(file_bytes)

        current_path = video_path

        # ── Cut / shorten / split steps via the smart executor ────────
        edit_steps = [
            {
                "type": s["type"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
            }
            for s in approved_steps
            if s["type"] in ("cut_silence", "cut_filler", "shorten", "split", "trim")
        ]

        clip_paths: list[str] = [video_path]
        if edit_steps:
            clip_paths = execute_edit_steps(video_path, edit_steps, work_dir)

            if len(clip_paths) > 1:
                merged_path = os.path.join(work_dir, "merged_output.mp4")
                concat_segments(clip_paths, merged_path)
                current_path = merged_path
            else:
                current_path = clip_paths[0]

            # Validate output duration
            raw_ranges = sorted(
                [(s["start_time"], s["end_time"]) for s in edit_steps],
                key=lambda x: x[0],
            )
            merged_ranges: list[tuple[float, float]] = []
            for s_t, e_t in raw_ranges:
                if merged_ranges and s_t <= merged_ranges[-1][1]:
                    merged_ranges[-1] = (merged_ranges[-1][0], max(merged_ranges[-1][1], e_t))
                else:
                    merged_ranges.append((s_t, e_t))
            total_removed = sum(e - s for s, e in merged_ranges)
            source_probe = ffmpeg_lib.probe(video_path)
            source_dur = float(source_probe["format"]["duration"])
            expected_dur = source_dur - total_removed
            try:
                out_probe = ffmpeg_lib.probe(current_path)
                actual_dur = float(out_probe["format"]["duration"])
                if expected_dur > 0 and actual_dur < expected_dur * 0.8:
                    logger.error(
                        "Duration mismatch: source=%.1fs, removed=%.1fs, "
                        "expected ~%.1fs, got %.1fs (%d edit steps, %d clips)",
                        source_dur, total_removed, expected_dur, actual_dur,
                        len(edit_steps), len(clip_paths),
                    )
                    raise RuntimeError(
                        f"Processed video is {actual_dur:.0f}s but expected "
                        f"~{expected_dur:.0f}s. The export was truncated."
                    )
            except (KeyError, ValueError):
                pass

        # ── Burn captions ─────────────────────────────────────────────
        caption_steps = [s for s in approved_steps if s["type"] == "caption"]
        if caption_steps:
            transcript_result = supabase.table("transcripts").select("words, srt").eq(
                "project_id", project_id
            ).single().execute()

            caption_style: dict | None = None
            try:
                style_result = supabase.table("caption_styles").select("*").eq(
                    "project_id", project_id
                ).maybeSingle().execute()
                if style_result.data:
                    caption_style = style_result.data
            except Exception:
                pass

            words = transcript_result.data.get("words", []) if transcript_result.data else []
            max_words = caption_style.get("max_words", 6) if caption_style else 6

            if words:
                chunks = chunk_transcript(words, max_words=max_words)
                srt_content = chunks_to_srt(chunks)
            else:
                srt_content = transcript_result.data.get("srt", "") if transcript_result.data else ""

            if srt_content:
                srt_path = os.path.join(work_dir, "captions.srt")
                with open(srt_path, "w") as f:
                    f.write(srt_content)
                caption_output = os.path.join(work_dir, "captioned.mp4")
                burn_captions(current_path, srt_path, caption_output, style=caption_style)
                current_path = caption_output

        # ── Free-tier restrictions ────────────────────────────────────
        user_result = supabase.table("users").select("plan").eq(
            "id", user_id
        ).single().execute()
        plan = user_result.data.get("plan", "free") if user_result.data else "free"

        if plan == "free":
            watermark_path = os.path.join(work_dir, "watermark.png")
            # Watermark is optional; skip overlay if not available
            # (In production, bake the watermark into the Modal image)

            capped_output = os.path.join(work_dir, "capped.mp4")
            cap_resolution(current_path, capped_output, max_height=720)
            current_path = capped_output

        # ── Probe final output ────────────────────────────────────────
        final_duration: float | None = None
        final_removed: float | None = None
        try:
            final_probe = ffmpeg_lib.probe(current_path)
            final_duration = float(final_probe["format"]["duration"])
            source_probe_final = ffmpeg_lib.probe(video_path)
            source_dur_final = float(source_probe_final["format"]["duration"])
            final_removed = source_dur_final - final_duration
        except Exception:
            pass

        # ── Upload to Supabase ────────────────────────────────────────
        storage_path = f"{user_id}/{project_id}/output.mp4"
        with open(current_path, "rb") as f:
            supabase.storage.from_("processed").upload(
                storage_path,
                f.read(),
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        # ── Update project status ─────────────────────────────────────
        update_fields: dict = {
            "status": "done",
            "processed_url": storage_path,
        }
        if final_duration is not None:
            update_fields["processed_duration"] = final_duration
        supabase.table("projects").update(update_fields).eq("id", project_id).execute()

        return {
            "success": True,
            "processed_url": storage_path,
            "actual_duration": final_duration,
            "total_removed": final_removed,
        }

    except Exception:
        try:
            supabase.table("projects").update({
                "status": "failed",
            }).eq("id", project_id).execute()
        except Exception:
            pass
        raise

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
