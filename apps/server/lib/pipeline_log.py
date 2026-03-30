"""Structured pipeline logging.

Prints a detailed trace of every decision to stdout (visible in Modal logs
and local terminal) and collects a compact summary for DB storage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class PipelineLog:
    """Accumulates structured log entries for a single pipeline run.

    Every decision is ``print()``-ed immediately for real-time visibility.
    Only the compact summary dict is meant for DB storage.
    """

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._total: int = 0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _record(self, phase: str, action: str, msg: str) -> None:
        key = f"{phase}.{action}"
        self._counts[key] = self._counts.get(key, 0) + 1
        self._total += 1
        print(f"  [{phase:8s}] {action:10s}  {msg}")

    # ------------------------------------------------------------------
    # Generic
    # ------------------------------------------------------------------

    def add(self, phase: str, action: str, **detail: Any) -> None:
        detail_str = ", ".join(f"{k}={v}" for k, v in detail.items())
        self._record(phase, action, detail_str)

    # ------------------------------------------------------------------
    # Silence phase
    # ------------------------------------------------------------------

    def silence_detected(
        self, start: float, end: float, duration: float, decision: str, score: int, score_reasons: list[str],
    ) -> None:
        reasons = " + ".join(score_reasons) if score_reasons else "none"
        self._record(
            "silence", decision,
            f"{start:.3f}-{end:.3f} ({duration:.3f}s)  score={score}  [{reasons}]",
        )

    def silence_skipped(self, start: float, end: float, duration: float, reason: str) -> None:
        self._record("silence", "skipped", f"{start:.3f}-{end:.3f} ({duration:.3f}s)  {reason}")

    # ------------------------------------------------------------------
    # Filler phase
    # ------------------------------------------------------------------

    def filler_cut(
        self, word: str, start: float, end: float, score: int, score_reasons: list[str],
    ) -> None:
        reasons = " + ".join(score_reasons) if score_reasons else "none"
        self._record("filler", "cut", f"'{word}' {start:.3f}-{end:.3f}  score={score}  [{reasons}]")

    def filler_skipped(self, word: str, start: float, end: float, score: int, reason: str) -> None:
        self._record("filler", "skipped", f"'{word}' {start:.3f}-{end:.3f}  score={score}  {reason}")

    # ------------------------------------------------------------------
    # Pacing phase
    # ------------------------------------------------------------------

    def pacing_trimmed(self, start: float, end: float, gap_before: float, gap_after: float) -> None:
        self._record("pacing", "trimmed", f"{start:.3f}-{end:.3f}  {gap_before:.3f}s → {gap_after:.3f}s")

    # ------------------------------------------------------------------
    # Merge phase
    # ------------------------------------------------------------------

    def merge(self, kept: int, merged: int) -> None:
        self._record("merge", "complete", f"{kept + merged} steps → {kept} after merge ({merged} overlaps)")

    # ------------------------------------------------------------------
    # Summary (compact — this is what goes in the DB)
    # ------------------------------------------------------------------

    def summary(self) -> dict[str, Any]:
        return {"entry_count": self._total, "counts": dict(self._counts)}
