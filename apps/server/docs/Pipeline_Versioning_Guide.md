# Pipeline Versioning Guide

How to add a new pipeline version to Somvo. Three files on the server, one on the frontend — nothing else changes.

---

## File structure

```
apps/server/
└── pipelines/
    ├── __init__.py          # Registry — maps "v1" → SilencePipeline, etc.
    ├── base.py              # BasePipeline ABC + PipelineInfo dataclass
    ├── v1_silence.py        # Whisper + silence/filler detection (free)
    ├── v2_director.py       # (future) GPT-4o filler + prompt understanding
    └── v3_style.py          # (future) Style matching + brand kits

apps/web/
└── lib/store/editor.ts      # PIPELINE_VERSIONS array (frontend picker metadata)
```

---

## Step-by-step: adding a new pipeline

### 1. Create the pipeline class

Create a new file in `apps/server/pipelines/`. Name it `v{N}_{slug}.py`.

```python
# apps/server/pipelines/v2_director.py

from __future__ import annotations
from typing import Any, AsyncGenerator
from pipelines.base import BasePipeline


class DirectorPipeline(BasePipeline):
    version = "v2"
    display_name = "Somvo v2"
    description = "GPT-4o filler detection, caption generation & prompt understanding"
    min_plan = "creator"
    available = True

    async def analyse(
        self, video_path: str, prompt: str, duration: float
    ) -> AsyncGenerator[dict[str, Any], None]:
        # Yield status messages as you go — these stream to the UI
        yield {"type": "status", "message": "Transcribing audio..."}

        # ... your logic here ...

        yield {"type": "status", "message": "Detecting filler words with GPT-4o..."}

        # ... more logic ...

        # Final yield MUST be a "result" dict with steps, log, and transcript
        yield {
            "type": "result",
            "steps": steps,          # list[EditStep]
            "log": pipeline_log,     # PipelineLog
            "transcript": transcript, # dict with "words" and "srt" keys
        }
```

### 2. Register it in `__init__.py`

```python
# apps/server/pipelines/__init__.py

from pipelines.v1_silence import SilencePipeline
from pipelines.v2_director import DirectorPipeline  # ← add import

PIPELINES: dict[str, BasePipeline] = {
    "v1": SilencePipeline(),
    "v2": DirectorPipeline(),  # ← add entry
}
```

### 3. Add frontend metadata

In `apps/web/lib/store/editor.ts`, add an entry to the `PIPELINE_VERSIONS` array:

```typescript
export const PIPELINE_VERSIONS: PipelineVersion[] = [
  {
    id: "v1",
    name: "Somvo v1",
    description: "Whisper transcription + silence & filler word removal",
    minPlan: "free",
    available: true,
  },
  {
    id: "v2",
    name: "Somvo v2",
    description: "GPT-4o filler detection, caption generation & prompt understanding",
    minPlan: "creator",
    available: true,  // ← flip to true when ready
  },
];
```

That's it. The dropdown, the SSE streaming, the DB storage — all route automatically.

---

## How the routing works

```
Frontend (dropdown)
  → user picks "v2"
  → stored in Zustand: pipelineVersion = "v2"
  → sent in POST /api/analyse body: { pipeline_version: "v2" }

Server (api/analyse.py)
  → pipeline = get_pipeline("v2")       # returns DirectorPipeline instance
  → async for event in pipeline.analyse(video_path, prompt, duration):
      → streams status messages + final steps to client

Nothing in analyse.py knows about v1 vs v2 internals.
```

---

## Contract: what `analyse()` must yield

Every pipeline's `analyse()` is an async generator that yields dicts:

| Event | Shape | When |
|-------|-------|------|
| Progress | `{"type": "status", "message": "..."}` | As many as you want during processing |
| Final result | `{"type": "result", "steps": [...], "log": PipelineLog, "transcript": dict}` | Exactly once, as the last yield |

The `steps` list contains `EditStep` objects (from `lib/step_types.py`):

```python
class EditStep(BaseModel):
    id: str                    # uuid4
    type: Literal["cut_silence", "cut_filler", "shorten", "split", "trim", "caption"]
    reason: str                # human-readable explanation
    start_time: float          # seconds
    end_time: float            # seconds
    confidence: Optional[int]  # scoring signal
```

The `transcript` dict must have:
- `"words"`: list of `{"word": str, "start": float, "end": float}`
- `"srt"`: string in SRT format

---

## Plan gating

Each pipeline has a `min_plan` field: `"free"`, `"creator"`, or `"pro"`.

On the frontend, the dropdown shows locked pipelines with a lock icon and plan badge. Users can't select them. When you're ready to gate server-side too, check the user's plan in `api/analyse.py` before calling the pipeline.

The `pipeline_version` column on `public.users` stores each user's default version.

---

## Versioning convention

- Pipeline versions (`v1`, `v2`, `v3`) are product versions — what the user sees.
- Git tags (`v1.0.0`, `v1.1.0`) are release versions — for your deploys.
- These are independent. Somvo v2 might ship in git release `v1.8.0`.

Use sub-versions (`v1.5`, `v3.5`) if a pipeline is a meaningful upgrade but not a full generation jump.

---

## Shared utilities

All pipelines share the same `lib/` modules:

- `lib/transcribe_openai.py` — Whisper transcription
- `lib/silence_detection.py` — silence detection + cross-validation
- `lib/cut_list.py` — scored cut list generation
- `lib/scoring.py` — confidence scoring
- `lib/pacing.py` — pacing optimisation
- `lib/edit_decision.py` — action thresholds
- `lib/pipeline_log.py` — structured logging
- `lib/step_types.py` — EditStep model

A new pipeline can reuse any of these, compose them differently, or add its own modules to `lib/`.
