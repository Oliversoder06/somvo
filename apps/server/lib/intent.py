"""Prompt intent resolver.

Bridges the LLM router (intent_router.py) with the pipeline feature flags
used throughout cut_list.py and the pipelines.

The flow is:
  1. intent_router.classify_intent(prompt) → LLM returns list of intent keys
  2. intents_to_edit_intent(keys)          → maps keys to EditIntent flags
  3. Pipeline checks EditIntent flags to decide what to run

─────────────────────────────────────────────────
Adding a new feature end-to-end:
  1. Add a Capability in intent_router.CAPABILITIES with supported=True.
  2. Add a bool flag to EditIntent below (e.g. want_speed_ramp).
  3. Add its intent key to INTENT_TO_FLAGS below.
  4. Implement the feature in cut_list.py / execute.py.
  → The LLM immediately knows the feature is available and will include
    it in classifications when the user asks for it.
─────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EditIntent — per-feature flags consumed by the pipeline
# ---------------------------------------------------------------------------

@dataclass
class EditIntent:
    """Resolved editing intent extracted from a user prompt.

    Every field maps to one pipeline feature.  Add new bool flags here
    when you add new supported capabilities.
    """

    want_silence_cuts: bool = True
    """Remove long silences and dead air."""

    want_filler_cuts: bool = True
    """Remove filler words (um, uh, like, …)."""

    want_pacing: bool = True
    """Add pacing-optimisation shorten steps (follows silence_removal)."""

    want_captions: bool = False
    """Burn captions / subtitles onto the exported video."""

    is_vague: bool = False
    """Prompt gave no recognisable instruction — all cut features on."""

    raw_prompt: str = ""
    """Original prompt for logging / debugging."""

    router_message: str = ""
    """Human-readable confirmation message from the LLM router."""

    unsupported_requests: list[str] = field(default_factory=list)
    """Feature requests the user made that aren't available yet."""


# ---------------------------------------------------------------------------
# Intent key → EditIntent flags map
#
# Each key is an intent returned by intent_router.classify_intent().
# Pacing is implicitly enabled whenever silence_removal is enabled —
# they go together naturally.
# ---------------------------------------------------------------------------

def intents_to_edit_intent(
    intents: list[str],
    *,
    raw_prompt: str = "",
    router_message: str = "",
    unsupported_requests: list[str] | None = None,
) -> EditIntent:
    """Convert a list of classified intent keys into an EditIntent."""
    intent_set = set(intents)

    want_silence = "silence_removal" in intent_set
    want_filler = "filler_removal" in intent_set
    want_captions = "captions" in intent_set
    # Pacing follows silence: if silence removal is on, so is pacing
    want_pacing = want_silence

    return EditIntent(
        want_silence_cuts=want_silence,
        want_filler_cuts=want_filler,
        want_pacing=want_pacing,
        want_captions=want_captions,
        is_vague=False,
        raw_prompt=raw_prompt,
        router_message=router_message,
        unsupported_requests=unsupported_requests or [],
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_intent(prompt: str) -> EditIntent:
    """Resolve user intent from a prompt.

    Uses the LLM router (gpt-4o-mini) for accurate classification,
    falls back to fast keyword matching if the LLM is unavailable.
    """
    try:
        from lib.intent_router import classify_intent
        classification = classify_intent(prompt)
        return intents_to_edit_intent(
            classification.get("intents", []),
            raw_prompt=prompt,
            router_message=classification.get("message", ""),
            unsupported_requests=classification.get("unsupported_requests", []),
        )
    except Exception as exc:
        logger.warning("[intent] LLM router unavailable (%s), using keyword fallback", exc)
        return _keyword_fallback(prompt)


# ---------------------------------------------------------------------------
# Keyword fallback (no OpenAI dependency)
# ---------------------------------------------------------------------------

_SILENCE_KW = {
    "silence", "silent", "silences", "pause", "pauses", "dead air",
    "gaps", "gap", "quiet",
}
_FILLER_KW = {
    "filler", "fillers", "filler word", "filler words",
    "um", "uh", "uhm", "hmm", "stammer", "hesitation",
}
_CAPTION_KW = {
    "caption", "captions", "subtitle", "subtitles", "sub", "subs",
    "burn subtitles", "burn captions", "add text",
    "closed caption", "closed captions", "cc",
}
_ONLY_MARKERS = {
    "only", "just", "solely", "nothing else",
    "don't cut", "do not cut", "without cutting", "no cuts",
}


def _keyword_fallback(prompt: str) -> EditIntent:
    """Simple keyword-based intent parsing used when the LLM is unavailable."""
    text = prompt.lower().strip()
    clean = re.sub(r"[^\w\s]", " ", text)
    words = set(clean.split())

    has_silence = _any_match(text, words, _SILENCE_KW)
    has_filler = _any_match(text, words, _FILLER_KW)
    has_captions = _any_match(text, words, _CAPTION_KW)
    has_only = _any_match(text, words, _ONLY_MARKERS)

    # "only captions / just subtitles" → no cuts
    if has_captions and has_only and not (has_silence or has_filler):
        return EditIntent(
            want_silence_cuts=False,
            want_filler_cuts=False,
            want_pacing=False,
            want_captions=True,
            is_vague=False,
            raw_prompt=prompt,
        )

    any_specific = has_silence or has_filler or has_captions
    if not any_specific:
        # Vague prompt — run everything
        return EditIntent(
            want_silence_cuts=True,
            want_filler_cuts=True,
            want_pacing=True,
            want_captions=False,
            is_vague=True,
            raw_prompt=prompt,
        )

    return EditIntent(
        want_silence_cuts=has_silence,
        want_filler_cuts=has_filler,
        want_pacing=has_silence,
        want_captions=has_captions,
        is_vague=False,
        raw_prompt=prompt,
    )


def _any_match(text: str, word_set: set[str], keywords: set[str]) -> bool:
    for kw in keywords:
        if " " in kw:
            if kw in text:
                return True
        elif kw in word_set:
            return True
    return False
