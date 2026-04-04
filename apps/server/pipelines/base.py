"""Base pipeline interface.

Every pipeline version implements this ABC. The /api/analyse endpoint
calls pipeline.analyse() and iterates the async generator to stream
status messages and final results to the client — it never needs to
know which pipeline it's running.

Adding a new pipeline version:
  1. Create e.g. ``v2_director.py`` with a class extending BasePipeline.
  2. Set version, display_name, description, min_plan, available.
  3. Implement ``analyse()``: parse the user's intent using
     ``lib.intent.parse_intent(prompt)`` and gate your features on it.
  4. Register in ``pipelines/__init__.py``.
  5. Add matching metadata to the frontend PIPELINE_VERSIONS constant.

Contract for the async generator yielded by analyse():
  {"type": "status",  "message": str}
      — progress message, streamed live to the client.
  {"type": "result",  "steps": list[EditStep], "log": PipelineLog, "transcript": dict}
      — final output; exactly one per run, yielded last.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncGenerator

from lib.pipeline_log import PipelineLog
from lib.step_types import EditStep


@dataclass
class PipelineInfo:
    """Static metadata exposed to the frontend for the version picker."""

    version: str
    name: str
    description: str
    min_plan: str   # "free" | "creator" | "pro"
    available: bool  # False = coming soon, greyed out in UI


class BasePipeline(ABC):
    version: str
    display_name: str
    description: str
    min_plan: str
    available: bool

    @property
    def info(self) -> PipelineInfo:
        return PipelineInfo(
            version=self.version,
            name=self.display_name,
            description=self.description,
            min_plan=self.min_plan,
            available=self.available,
        )

    @abstractmethod
    async def analyse(
        self, video_path: str, prompt: str, duration: float
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Async generator yielding pipeline events.

        IMPORTANT: always call ``lib.intent.parse_intent(prompt)`` at the
        start of your implementation and gate every feature on the returned
        ``EditIntent`` flags.  This ensures the user only gets the features
        they actually asked for and the pipeline never does something the
        user didn't intend.

        Yields dicts with one of:
          {"type": "status",  "message": str}
          {"type": "result",  "steps": list[EditStep],
                              "log": PipelineLog,
                              "transcript": dict}
        """
        ...
        yield {}  # pragma: no cover — makes the type-checker happy
