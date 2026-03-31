"""LLM-powered intent router.

Classifies user prompts into supported system capabilities or
identifies unsupported requests, using a cheap OpenAI model.

The capabilities registry (CAPABILITIES) is the single source of truth.
To add a new feature, just add an entry with supported=True — the system
prompt builds itself automatically.
"""

import json
import logging
import os
from dataclasses import dataclass

from openai import OpenAI

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Capabilities registry — flip supported to True when a feature ships
# ---------------------------------------------------------------------------

@dataclass
class Capability:
    intent: str          # machine key returned by the LLM
    name: str            # short human label
    description: str     # what it does (shown to the LLM)
    supported: bool      # is it live in the system right now?


CAPABILITIES: list[Capability] = [
    # ---- Supported ----
    Capability(
        intent="clean_edit",
        name="Clean edit",
        description="Removes silence/dead air, filler words (um, uh, like…), "
                    "tightens pacing, and splits clips at natural boundaries. "
                    "All happen together as a single automated pass.",
        supported=True,
    ),

    # ---- Not yet supported ----
    Capability(intent="captions",       name="Captions / subtitles",        description="Burn-in or overlay captions on the video",           supported=True),
    Capability(intent="music",           name="Music / sound effects",       description="Add background music or sound effects",              supported=False),
    Capability(intent="color_grade",     name="Color grading / filters",     description="Apply color grading or visual filters",              supported=False),
    Capability(intent="transitions",     name="Transitions / effects",       description="Add transitions or visual effects between clips",    supported=False),
    Capability(intent="crop_resize",     name="Crop / resize / reformat",    description="Crop, resize, or change aspect ratio",               supported=False),
    Capability(intent="speed",           name="Speed changes",               description="Slow-mo, timelapse, or speed ramp",                  supported=False),
    Capability(intent="text_overlay",    name="Text overlays / graphics",    description="Add text, titles, or graphic overlays",              supported=False),
    Capability(intent="reorder",         name="Reorder clips",               description="Rearrange or reorder video segments",                supported=False),
    Capability(intent="ai_generate",     name="Generative AI content",       description="AI voiceover, AI-generated visuals, etc.",           supported=False),
]


def _build_system_prompt() -> str:
    """Build the classifier system prompt from the live registry."""
    supported = [c for c in CAPABILITIES if c.supported]
    unsupported = [c for c in CAPABILITIES if not c.supported]

    intent_keys = [c.intent for c in CAPABILITIES]

    lines = [
        "You are an intent classifier for a video editing tool called Somvo.\n",
        "The system currently supports:",
    ]
    for c in supported:
        lines.append(f'- "{c.intent}": {c.name} — {c.description}')

    if unsupported:
        lines.append("\nThe system does NOT currently support:")
        for c in unsupported:
            lines.append(f"- {c.name} ({c.description})")

    lines.append(
        "\nGiven a user prompt, classify their intent.\n"
        "Respond with JSON:\n"
        "{\n"
        f'  "intent": one of {intent_keys} or "unsupported",\n'
        '  "supported": true or false,\n'
        '  "message": "A single short sentence for the user. '
        "If supported, confirm what you will do. "
        "If unsupported, say what is not available yet and briefly "
        'suggest what the system CAN do instead."\n'
        "}"
    )
    return "\n".join(lines)


def classify_intent(prompt: str) -> dict:
    """Classify a user prompt into a supported or unsupported intent."""
    model = os.environ.get("ROUTER_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    system_prompt = _build_system_prompt()

    logger.info("[intent] User prompt: %r", prompt)
    logger.info("[intent] Using model: %s", model)
    logger.debug("[intent] System prompt:\n%s", system_prompt)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=200,
        )

        content = response.choices[0].message.content or "{}"
        logger.info("[intent] Raw LLM response: %s", content)

        result = json.loads(content)
        classification = {
            "intent": result.get("intent", "clean_edit"),
            "supported": result.get("supported", True),
            "message": result.get("message", ""),
        }
        logger.info(
            "[intent] Classification → intent=%s  supported=%s  message=%r",
            classification["intent"],
            classification["supported"],
            classification["message"],
        )
        return classification
    except Exception as e:
        logger.warning("[intent] Classification failed: %s — defaulting to clean_edit", e)
        return {
            "intent": "clean_edit",
            "supported": True,
            "message": "",
        }
