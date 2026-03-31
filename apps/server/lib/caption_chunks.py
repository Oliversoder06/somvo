"""Caption chunking — groups word-level timestamps into display-ready subtitle phrases.

The same algorithm runs client-side (TypeScript) for the preview overlay
and server-side (here) for burning styled captions into the exported video.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_SENTENCE_END = re.compile(r"[.?!]$")
_CLAUSE_BREAK = re.compile(r",$")

MAX_DURATION = 2.5  # seconds
MIN_WORDS_FOR_GAP_BREAK = 3
GAP_THRESHOLD = 0.4  # seconds


@dataclass
class CaptionChunk:
    id: int
    words: list[dict]
    text: str
    start: float
    end: float


def chunk_transcript(words: list[dict], max_words: int = 6) -> list[CaptionChunk]:
    """Group word dicts ``{word, start, end}`` into display-ready chunks.

    Uses a hybrid strategy:
      1. Time cap — no chunk longer than ~2.5 s.
      2. Word cap — controlled by *max_words* (default 6).
      3. Natural breaks — punctuation, breathing pauses, clause boundaries.
    """
    if not words:
        return []

    chunks: list[CaptionChunk] = []
    current: list[dict] = []
    chunk_id = 0

    def finalise() -> None:
        nonlocal chunk_id
        if not current:
            return
        chunks.append(
            CaptionChunk(
                id=chunk_id,
                words=list(current),
                text=" ".join(w["word"] for w in current),
                start=current[0]["start"],
                end=current[-1]["end"],
            )
        )
        chunk_id += 1
        current.clear()

    for i, w in enumerate(words):
        current.append(w)

        duration = current[-1]["end"] - current[0]["start"]
        word_count = len(current)
        trimmed = w["word"].strip()
        next_word = words[i + 1] if i + 1 < len(words) else None
        gap = (next_word["start"] - w["end"]) if next_word else 0.0

        is_sentence_end = bool(_SENTENCE_END.search(trimmed))
        is_clause_break = bool(_CLAUSE_BREAK.search(trimmed)) and word_count >= 4
        is_time_overflow = duration >= MAX_DURATION
        is_word_overflow = word_count >= max_words
        is_natural_pause = gap > GAP_THRESHOLD and word_count >= MIN_WORDS_FOR_GAP_BREAK

        if is_sentence_end or is_clause_break or is_time_overflow or is_word_overflow or is_natural_pause:
            finalise()

    finalise()
    return chunks


def chunks_to_srt(chunks: list[CaptionChunk]) -> str:
    """Convert caption chunks to an SRT string."""
    lines: list[str] = []
    for i, c in enumerate(chunks, 1):
        start_tc = _srt_timecode(c.start)
        end_tc = _srt_timecode(c.end)
        lines.append(f"{i}")
        lines.append(f"{start_tc} --> {end_tc}")
        lines.append(c.text)
        lines.append("")
    return "\n".join(lines)


def _srt_timecode(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
