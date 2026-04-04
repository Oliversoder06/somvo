"""v1 — Silence & filler-word pipeline.

Whisper transcription → cross-validated silence detection → scored cut list.

The user's prompt is parsed via the LLM intent router; only the requested
features run.  The LLM's confirmation message is streamed back to the UI
so the user knows exactly what the system understood.

Examples
--------
  "add captions"                → caption step only, no cuts
  "remove silences"             → silence cuts only, no fillers
  "remove fillers"              → filler cuts only, no silence cuts
  "remove silences and fillers" → both
  "clean up this video"         → all features (vague → safe default)
  "add speed ramp"              → unsupported message streamed to user
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from lib.cut_list import generate_cut_list
from lib.intent import parse_intent
from lib.silence_detection import detect_silence_combined
from lib.transcribe_openai import transcribe_video
from pipelines.base import BasePipeline


class SilencePipeline(BasePipeline):
    version = "v1"
    display_name = "Somvo v1"
    description = "Whisper transcription + silence & filler word removal"
    min_plan = "free"
    available = True

    async def analyse(
        self, video_path: str, prompt: str, duration: float
    ) -> AsyncGenerator[dict[str, Any], None]:

        # ── 1. Resolve user intent ────────────────────────────────────────
        intent = parse_intent(prompt)

        # Stream what the system understood back to the user
        if intent.router_message:
            yield {"type": "status", "message": intent.router_message}
        else:
            yield {"type": "status", "message": _intent_status(intent)}

        # Warn about unsupported requests immediately so the user isn't confused
        for req in intent.unsupported_requests:
            yield {
                "type": "status",
                "message": f"Note: '{req}' is not yet supported — skipping.",
            }

        # ── 2. Transcription (always needed for word timestamps + SRT) ────
        yield {"type": "status", "message": "Transcribing audio..."}
        transcript = transcribe_video(video_path)
        word_count = len(transcript["words"])
        yield {"type": "status", "message": f"Transcript: {word_count} words found"}

        # ── 3. Silence detection (skip if no cut features requested) ──────
        silence_segments: list[dict] = []
        audio_silences: list[dict] | None = None

        if intent.want_silence_cuts:
            silence_segments, audio_silences = detect_silence_combined(
                video_path, transcript["words"]
            )
            yield {
                "type": "status",
                "message": f"Detected {len(silence_segments)} silence regions",
            }

        # ── 4. Build cut list ─────────────────────────────────────────────
        steps, pipeline_log = generate_cut_list(
            silence_segments,
            transcript,
            duration,
            intent,
            audio_silences=audio_silences,
        )

        cut_count = sum(1 for s in steps if s.type != "caption")
        caption_count = sum(1 for s in steps if s.type == "caption")

        parts = []
        if cut_count:
            parts.append(f"{cut_count} cuts")
        if caption_count:
            parts.append("captions")
        summary = ", ".join(parts) if parts else "nothing to change"
        yield {"type": "status", "message": f"Proposing: {summary}"}

        yield {
            "type": "result",
            "steps": steps,
            "log": pipeline_log,
            "transcript": transcript,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _intent_status(intent) -> str:
    """Fallback status message when the LLM didn't produce one."""
    parts = []
    if intent.want_silence_cuts:
        parts.append("silence removal")
    if intent.want_filler_cuts:
        parts.append("filler removal")
    if intent.want_pacing:
        parts.append("pacing")
    if intent.want_captions:
        parts.append("captions")

    label = ", ".join(parts) if parts else "full edit"
    prefix = "Running" if not intent.is_vague else "Running full edit"
    return f"{prefix}: {label}..."
