"""Base pipeline interface.

Every pipeline version implements this ABC. The /api/analyse endpoint
calls pipeline.analyse() and iterates the async generator to stream
status messages and final results to the client — it never needs to
know which pipeline it's running.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

from lib.pipeline_log import PipelineLog
from lib.step_types import EditStep


@dataclass
class PipelineInfo:
    """Static metadata exposed to the frontend for the version picker."""

    version: str
    name: str
    description: str
    min_plan: str  # "free" | "creator" | "pro"
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

        Yields dicts with one of these shapes:
          {"type": "status", "message": str}
          {"type": "result", "steps": list[EditStep], "log": PipelineLog, "transcript": dict}
        """
        ...
        yield {}  # pragma: no cover — makes the type-checker happy
