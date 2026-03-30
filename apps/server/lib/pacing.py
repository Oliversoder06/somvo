"""Post-cut pacing optimisation.

After all cut/shorten decisions are made, this module enforces a maximum
gap between speech segments — but uses variable targets to preserve
natural rhythm instead of flattening everything to one value.
"""

from __future__ import annotations

from uuid import uuid4

from lib.edit_decision import compute_shorten_bounds
from lib.step_types import EditStep


def _pacing_target(gap_dur: float) -> float:
    """Return a natural-feeling target duration for a gap.

    Instead of forcing everything to one number, use a curve:
      gap 0.7–1.5s  → shrink to 0.5–0.6s  (gentle trim)
      gap 1.5–3.0s  → shrink to 0.4–0.5s  (moderate trim)
      gap > 3.0s    → shrink to 0.4s       (hard trim)
    """
    if gap_dur <= 1.5:
        # Gentle: keep more of the pause (0.5–0.6s)
        return 0.55
    if gap_dur <= 3.0:
        # Moderate: tighter but not robotic (0.4–0.5s)
        return 0.45
    # Long gaps: trim hard
    return 0.4


def optimize_pacing(
    words: list[dict],
    existing_steps: list[EditStep],
    max_gap: float = 0.7,
) -> list[EditStep]:
    """Add shorten steps so no remaining speech gap exceeds *max_gap*.

    Gaps below *max_gap* are left untouched (safe zone).
    Gaps above are trimmed to a variable target that depends on how
    long the gap is, preserving natural speech rhythm.

    Parameters
    ----------
    words:
        Transcript word list (each with ``start`` / ``end``).
    existing_steps:
        Steps already generated (cuts, shortens, splits).
        Gaps already covered by these steps are skipped.
    max_gap:
        Gaps at or below this value are never touched.

    Returns
    -------
    list[EditStep]
        Additional *shorten* steps to add (may be empty).
    """
    if len(words) < 2:
        return []

    # Build set of intervals already being cut / shortened
    covered: list[tuple[float, float]] = []
    for s in existing_steps:
        covered.append((s.start_time, s.end_time))
    covered.sort()

    extra: list[EditStep] = []

    for i in range(1, len(words)):
        gap_start = words[i - 1]["end"]
        gap_end = words[i]["start"]
        gap_dur = gap_end - gap_start

        if gap_dur <= max_gap:
            continue

        # How much of this gap is already being removed?
        already_removed = _overlap_with_covered(gap_start, gap_end, covered)
        remaining = gap_dur - already_removed

        if remaining <= max_gap:
            continue

        # Pick a natural target based on the original gap size
        target = _pacing_target(gap_dur)

        # Find the uncovered portion and trim it.
        uncovered = _uncovered_span(gap_start, gap_end, covered)
        for u_start, u_end in uncovered:
            u_dur = u_end - u_start
            if u_dur <= target:
                continue
            cut_start, cut_end = compute_shorten_bounds(u_start, u_end, target=target)
            if cut_end <= cut_start:
                continue
            cut_dur = cut_end - cut_start
            extra.append(EditStep(
                id=str(uuid4()),
                type="shorten",
                reason=f"Pacing: {gap_dur:.2f}s gap → ~{target}s",
                start_time=cut_start,
                end_time=cut_end,
                confidence=2,
            ))

    return extra


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _overlap_with_covered(
    start: float, end: float, covered: list[tuple[float, float]]
) -> float:
    """Total overlap of [start, end] with the covered intervals."""
    total = 0.0
    for cs, ce in covered:
        o_start = max(start, cs)
        o_end = min(end, ce)
        if o_end > o_start:
            total += o_end - o_start
    return total


def _uncovered_span(
    start: float, end: float, covered: list[tuple[float, float]]
) -> list[tuple[float, float]]:
    """Return sub-intervals of [start, end] not overlapping *covered*."""
    # Sort and clip covered to our range
    relevant = []
    for cs, ce in covered:
        cs = max(cs, start)
        ce = min(ce, end)
        if ce > cs:
            relevant.append((cs, ce))
    relevant.sort()

    spans: list[tuple[float, float]] = []
    cursor = start
    for cs, ce in relevant:
        if cs > cursor:
            spans.append((cursor, cs))
        cursor = max(cursor, ce)
    if cursor < end:
        spans.append((cursor, end))
    return spans
