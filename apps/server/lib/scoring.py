"""Cut confidence scoring.

Each potential edit is scored based on multiple signals.
Only edits meeting the configurable threshold are included.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CutScore:
    score: int = 0
    reasons: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Silence-based scoring
# ---------------------------------------------------------------------------

def score_silence(
    silence_duration: float,
    has_transcript_gap: bool = True,
    low_energy: bool = False,
    overlaps_speech: bool = False,
) -> CutScore:
    """Score a silence-based edit (cut or shorten).

    Signals:
      silence_duration > 1.0s  → +2
      silence_duration > 0.5s  → +1
      transcript gap matches   → +1
      low audio energy         → +1
      overlaps speech         → -2
    """
    score = 0
    reasons: list[str] = []

    if silence_duration > 1.0:
        score += 2
        reasons.append("long silence >1s")
    elif silence_duration > 0.5:
        score += 1
        reasons.append("medium silence >0.5s")

    if has_transcript_gap:
        score += 1
        reasons.append("transcript gap")

    if low_energy:
        score += 1
        reasons.append("low audio energy")

    if overlaps_speech:
        score -= 2
        reasons.append("overlaps speech")

    return CutScore(score=score, reasons=reasons)


# ---------------------------------------------------------------------------
# Filler-word scoring
# ---------------------------------------------------------------------------

def score_filler(
    word: str,
    *,
    word_confidence: float | None = None,
    neighbor_gap_before: float | None = None,
    neighbor_gap_after: float | None = None,
    min_neighbor_gap: float = 0.08,
) -> CutScore:
    """Score a filler-word cut.

    Penalise when:
      - transcript confidence is below 0.5  → −1
      - neighbouring words are very close    → −1 (likely part of a phrase)
    """
    score = 2  # base score for any filler word
    reasons: list[str] = [f"filler word: '{word}'"]

    if word_confidence is not None and word_confidence < 0.5:
        score -= 1
        reasons.append("low transcript confidence")

    neighbours_close = False
    if neighbor_gap_before is not None and neighbor_gap_before < min_neighbor_gap:
        neighbours_close = True
    if neighbor_gap_after is not None and neighbor_gap_after < min_neighbor_gap:
        neighbours_close = True

    if neighbours_close:
        score -= 1
        reasons.append("close to neighbouring speech")

    return CutScore(score=score, reasons=reasons)
