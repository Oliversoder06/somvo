"""Decide the editing action for each detected segment.

Maps raw silence/filler detections into concrete edit actions
(keep / shorten / cut / split) based on configurable thresholds.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ActionType = Literal["keep", "shorten", "cut", "split"]


@dataclass
class SilenceThresholds:
    """All silence-handling thresholds in one place."""

    keep_below: float = 0.5
    """Silence shorter than this is left untouched (natural pause)."""

    shorten_below: float = 0.7
    """Silence between keep_below and shorten_below is shortened."""

    shorten_target: float = 0.3
    """Target duration when shortening a silence gap."""

    split_above: float = 2.0
    """Silence longer than this marks a clip split boundary."""


DEFAULT_THRESHOLDS = SilenceThresholds()


def decide_silence_action(
    duration: float,
    thresholds: SilenceThresholds = DEFAULT_THRESHOLDS,
) -> ActionType:
    """Return the action to take for a silence gap of *duration* seconds."""
    if duration < thresholds.keep_below:
        return "keep"
    if duration <= thresholds.shorten_below:
        return "shorten"
    if duration > thresholds.split_above:
        return "split"
    return "cut"


def compute_shorten_bounds(
    seg_start: float,
    seg_end: float,
    target: float = DEFAULT_THRESHOLDS.shorten_target,
) -> tuple[float, float]:
    """Return (cut_start, cut_end) that trim the middle of the gap.

    Keeps ``target / 2`` on each side so the shortened silence is
    approximately *target* seconds.
    """
    gap = seg_end - seg_start
    remove = gap - target
    if remove <= 0:
        return seg_start, seg_start  # nothing to remove
    half_keep = target / 2
    cut_start = round(seg_start + half_keep, 3)
    cut_end = round(seg_end - half_keep, 3)
    return cut_start, cut_end
