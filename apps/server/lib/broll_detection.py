"""B-roll moment detection.

Analyses a word-level transcript to find moments where B-roll footage
would enhance the video, using OpenAI for semantic understanding.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from openai import OpenAI

from lib.intent import EditIntent

logger = logging.getLogger(__name__)

_MAX_MOMENTS = 8
_MIN_CONFIDENCE = 0.5
_MIN_DURATION = 1.5

_SYSTEM_PROMPT = """\
You are a video editing assistant that identifies moments in a transcript \
where B-roll (stock footage) would improve the final video.

## Step 1 — Suitability check

First determine if this video type is suitable for B-roll insertion. \
Return an EMPTY "moments" array if the video is any of:
- Gaming footage or gameplay commentary
- Reaction / watch-along content
- Screen recordings / tutorials showing a screen
- Music videos or performances
- Content where the speaker's face/actions are the primary visual focus throughout

## Step 2 — Identify B-roll moments

If the video IS suitable, find moments where the speaker references \
something concrete and visual that stock footage could illustrate:
- Physical places, landmarks, cities
- Objects, products, tools
- Activities, sports, actions
- Nature, animals, weather
- Statistics or data (use related imagery)
- Anecdotes referencing visual scenes

For each moment return:
- start: float — timestamp (seconds) where the moment begins
- end: float — timestamp (seconds) where the moment ends
- query: string — a short 2–4 word Pexels search query
- confidence: float — 0.0 to 1.0 self-assessed relevance score
- reason: string — one sentence explaining why B-roll fits here

Rules:
- Maximum 8 moments per video
- Each moment must be at least 1.5 seconds long
- Queries should be generic enough to find good stock footage
- Do not suggest B-roll for the intro/outro of the video
- Space moments out — avoid clustering

Respond ONLY with valid JSON:
{
  "suitable": true/false,
  "moments": [...]
}
"""


async def detect_broll_moments(
    transcript: list[dict[str, Any]],
    intent: EditIntent,
) -> list[dict[str, Any]]:
    """Detect moments in the transcript where B-roll would add value.

    Parameters
    ----------
    transcript : list[dict]
        Word-level transcript entries with ``word``, ``start``, ``end``.
    intent : EditIntent
        The resolved editing intent (used for context).

    Returns
    -------
    list[dict]
        Each dict has: start, end, query, confidence, reason.
    """
    if not transcript:
        return []

    # Build full text with timestamps for the LLM
    text_parts: list[str] = []
    for w in transcript:
        text_parts.append(f"[{w['start']:.1f}s] {w['word']}")
    full_text = " ".join(text_parts)

    # Truncate to ~12k chars to stay within token limits
    if len(full_text) > 12000:
        full_text = full_text[:12000] + "..."

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = os.environ.get("BROLL_MODEL", "gpt-4o-mini")

    user_message = (
        f"Transcript with timestamps:\n\n{full_text}\n\n"
        f"Original user prompt: {intent.raw_prompt}"
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=1500,
        )

        content = response.choices[0].message.content or "{}"
        raw = json.loads(content)

        if not raw.get("suitable", False):
            logger.info("[broll] Video deemed unsuitable for B-roll")
            return []

        moments = raw.get("moments", [])

        # Filter and validate
        valid: list[dict[str, Any]] = []
        for m in moments:
            conf = float(m.get("confidence", 0))
            start = float(m.get("start", 0))
            end = float(m.get("end", 0))
            duration = end - start

            if conf < _MIN_CONFIDENCE:
                continue
            if duration < _MIN_DURATION:
                continue
            if not m.get("query"):
                continue

            valid.append({
                "start": start,
                "end": end,
                "query": str(m["query"]),
                "confidence": conf,
                "reason": str(m.get("reason", "")),
            })

        # Limit to max moments
        valid = sorted(valid, key=lambda x: x["confidence"], reverse=True)[:_MAX_MOMENTS]
        # Re-sort by timestamp for timeline ordering
        valid.sort(key=lambda x: x["start"])

        logger.info("[broll] Detected %d B-roll moments", len(valid))
        return valid

    except Exception as exc:
        logger.warning("[broll] Detection failed: %s", exc)
        return []
