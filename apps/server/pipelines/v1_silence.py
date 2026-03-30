"""v1 — Silence & filler-word pipeline.

Whisper transcription → cross-validated silence detection → scored cut list.
This is the original Somvo analysis logic, now wrapped as a pipeline class.
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from pipelines.base import BasePipeline
from lib.cut_list import generate_cut_list
from lib.silence_detection import detect_silence_combined
from lib.transcribe_openai import transcribe_video


class SilencePipeline(BasePipeline):
    version = "v1"
    display_name = "Somvo v1"
    description = "Whisper transcription + silence & filler word removal"
    min_plan = "free"
    available = True

    async def analyse(
        self, video_path: str, prompt: str, duration: float
    ) -> AsyncGenerator[dict[str, Any], None]:
        yield {"type": "status", "message": "Transcribing audio..."}

        transcript = transcribe_video(video_path)
        word_count = len(transcript["words"])

        yield {"type": "status", "message": f"Found {word_count} words"}

        silences = detect_silence_combined(video_path, transcript["words"])

        yield {"type": "status", "message": f"Detected {len(silences)} silence regions"}

        steps, pipeline_log = generate_cut_list(silences, transcript, duration)

        yield {"type": "status", "message": "Proposing cuts..."}
        yield {
            "type": "result",
            "steps": steps,
            "log": pipeline_log,
            "transcript": transcript,
        }
