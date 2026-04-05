"""LLM-powered intent router.

Classifies user prompts into one or more supported capabilities using
a cheap OpenAI model. Returns a list so combined requests like
"remove silences AND add captions" are handled correctly.

─────────────────────────────────────────────────
To add a new feature to the system:
  1. Add a Capability entry below with supported=True.
  2. Map its intent key in lib/intent.py → EditIntent flags.
  3. Implement the feature in lib/cut_list.py (or a new lib file).
  4. That's it — the LLM immediately knows the feature exists.
─────────────────────────────────────────────────
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

from openai import OpenAI

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Capabilities registry — THE single source of truth for what Somvo can do.
# Flip supported=True when a feature ships. The system prompt + parser
# are rebuilt automatically — no other changes needed here.
# ---------------------------------------------------------------------------

@dataclass
class Capability:
    intent: str          # machine key returned by the LLM
    name: str            # short human label
    description: str     # what it does (shown to the LLM for self-description)
    supported: bool      # is it live right now?


CAPABILITIES: list[Capability] = [
    # ── Supported ────────────────────────────────────────────────────────────
    Capability(
        intent="silence_removal",
        name="Silence & dead-air removal",
        description=(
            "Detects and removes silence, dead air, long pauses, and "
            "gaps between speech segments. Also trims oversized pauses."
        ),
        supported=True,
    ),
    Capability(
        intent="filler_removal",
        name="Filler word removal",
        description=(
            "Removes filler words and hesitations: um, uh, like, "
            "basically, literally, actually, so, right, hmm, etc."
        ),
        supported=True,
    ),
    Capability(
        intent="captions",
        name="Captions / subtitles",
        description=(
            "Generates word-timed captions from the transcript and "
            "burns them permanently into the exported video."
        ),
        supported=True,
    ),
    Capability(
        intent="broll",
        name="B-roll insertion",
        description=(
            "Detects moments in the transcript where stock B-roll footage "
            "would enhance the video, searches for matching clips, and "
            "splices them in. Triggered by requests for b-roll, visuals, "
            "stock footage, or general improvement prompts."
        ),
        supported=True,
    ),

    # ── Coming soon ──────────────────────────────────────────────────────────
    Capability(
        intent="music",
        name="Background music / sound effects",
        description="Add background music or sound effects to the video.",
        supported=False,
    ),
    Capability(
        intent="color_grade",
        name="Color grading / filters",
        description="Apply color grading or visual filters to footage.",
        supported=False,
    ),
    Capability(
        intent="transitions",
        name="Transitions / effects",
        description="Add transitions or visual effects between clips.",
        supported=False,
    ),
    Capability(
        intent="crop_resize",
        name="Crop / resize / reformat",
        description="Crop, resize, or change the aspect ratio.",
        supported=False,
    ),
    Capability(
        intent="speed",
        name="Speed changes",
        description="Slow-motion, timelapse, or speed ramping.",
        supported=False,
    ),
    Capability(
        intent="text_overlay",
        name="Text overlays / graphics",
        description="Add text titles, lower-thirds, or graphic overlays.",
        supported=False,
    ),
    Capability(
        intent="reorder",
        name="Reorder clips",
        description="Rearrange or reorder video segments.",
        supported=False,
    ),
    Capability(
        intent="ai_generate",
        name="Generative AI content",
        description="AI voiceover, AI-generated visuals, avatar replacement.",
        supported=False,
    ),
]

# Convenience lookups
_SUPPORTED_INTENTS = {c.intent for c in CAPABILITIES if c.supported}
_ALL_INTENTS = {c.intent for c in CAPABILITIES}


# ---------------------------------------------------------------------------
# System prompt (auto-built from registry)
# ---------------------------------------------------------------------------

def _build_system_prompt() -> str:
    supported = [c for c in CAPABILITIES if c.supported]
    unsupported = [c for c in CAPABILITIES if not c.supported]
    all_intent_keys = [c.intent for c in CAPABILITIES]

    lines = [
        "You are an intent classifier for a video editing tool called Somvo.\n",
        "## Features the system currently supports",
    ]
    for c in supported:
        lines.append(f'- "{c.intent}": {c.name} — {c.description}')

    if unsupported:
        lines.append("\n## Features NOT yet available")
        for c in unsupported:
            lines.append(f'- "{c.intent}": {c.name} — {c.description}')

    lines.append(
        "\n## Task\n"
        "Given a user prompt, identify ALL features the user wants.\n"
        "A user can request multiple features at once (e.g. 'remove silences AND add captions').\n\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        f'  "intents": [list of intent keys from {all_intent_keys}],\n'
        '  "unsupported_requests": [list of features asked for that are not available],\n'
        '  "message": "One short sentence: confirm what WILL be done, and if anything '
        'was unsupported, mention it and suggest what the system CAN do."\n'
        "}\n\n"
        "Rules:\n"
        "- Include only supported intents in 'intents'.\n"
        "- If the user asks for a general 'clean up' or 'edit this video' with no specifics, "
        'include both "silence_removal" and "filler_removal".\n'
        "- If the user asks ONLY for captions, do NOT include silence_removal or filler_removal.\n"
        "- Never include unsupported intents in 'intents'.\n"
        "- If nothing matches, default to silence_removal and filler_removal."
    )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_intent(prompt: str) -> dict:
    """Classify a user prompt.

    Returns::

        {
            "intents": ["silence_removal", "captions"],   # list of active intents
            "unsupported_requests": [],                   # things asked for but not available
            "message": "Will remove silences and burn captions.",
            "supported": True,                            # compat: True if any intent is supported
        }
    """
    model = os.environ.get("ROUTER_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    system_prompt = _build_system_prompt()

    logger.info("[intent] Prompt: %r  model: %s", prompt, model)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=300,
        )

        content = response.choices[0].message.content or "{}"
        logger.info("[intent] LLM response: %s", content)

        raw = json.loads(content)
        intents: list[str] = [
            i for i in raw.get("intents", []) if i in _SUPPORTED_INTENTS
        ]
        unsupported: list[str] = raw.get("unsupported_requests", [])
        message: str = raw.get("message", "")

        # Fallback: if LLM returned nothing meaningful, run the full clean edit
        if not intents:
            intents = ["silence_removal", "filler_removal"]

        result = {
            "intents": intents,
            "unsupported_requests": unsupported,
            "message": message,
            "supported": True,
        }
        logger.info("[intent] Resolved → %s", result)
        return result

    except Exception as exc:
        logger.warning("[intent] Classification failed (%s) — defaulting to full clean edit", exc)
        return {
            "intents": ["silence_removal", "filler_removal"],
            "unsupported_requests": [],
            "message": "",
            "supported": True,
        }
