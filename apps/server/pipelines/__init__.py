"""Pipeline registry.

Maps version strings to pipeline instances.  The /api/analyse endpoint
calls ``get_pipeline(version)`` and never touches the concrete classes.

To add a new pipeline version:
  1. Create a new file (e.g. v2_director.py) with a class extending BasePipeline.
  2. Import and register it in PIPELINES below.
  3. Add matching metadata to the frontend PIPELINE_VERSIONS constant.

That's it — everything else routes automatically.
"""

from __future__ import annotations

from pipelines.base import BasePipeline, PipelineInfo
from pipelines.v1_silence import SilencePipeline

# ---- Registry ----

PIPELINES: dict[str, BasePipeline] = {
    "v1": SilencePipeline(),
}

DEFAULT_VERSION = "v1"


def get_pipeline(version: str) -> BasePipeline:
    """Return the pipeline for *version*, falling back to the default."""
    return PIPELINES.get(version, PIPELINES[DEFAULT_VERSION])


def list_pipelines() -> list[PipelineInfo]:
    """Return metadata for every registered pipeline (for the frontend picker)."""
    return [p.info for p in PIPELINES.values()]
