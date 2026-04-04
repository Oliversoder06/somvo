"""Cut-list generation.

Pipeline: detect → score → decide → optimise pacing → merge → return.

Adding a new feature:
  1. Add it as an ``EditIntent`` flag in ``lib/intent.py``.
  2. Add a generation block in ``generate_cut_list`` guarded by the flag.
  3. Steps are automatically sorted, de-overlapped, and returned.
"""

from __future__ import annotations

import re
from uuid import uuid4

from lib.edit_decision import (
    SilenceThresholds,
    compute_shorten_bounds,
    decide_silence_action,
)
from lib.intent import EditIntent
from lib.pacing import optimize_pacing
from lib.pipeline_log import PipelineLog
from lib.scoring import score_filler, score_silence
from lib.step_types import EditStep

FILLER_WORDS = {
    "um", "uh", "uh-huh", "mm", "hmm", "mhm",
    "like", "basically", "literally",
    "actually", "so", "right",
}

# 75ms padding on each side prevents clipped syllables at cut boundaries
PADDING_S = 0.075


def _audio_overlap_ratio(
    seg_start: float,
    seg_end: float,
    audio_silences: list[dict],
) -> float:
    """Return the fraction of [seg_start, seg_end] covered by audio silence."""
    seg_dur = seg_end - seg_start
    if seg_dur <= 0:
        return 0.0
    total = 0.0
    for au in audio_silences:
        o_start = max(seg_start, au["start"])
        o_end = min(seg_end, au["end"])
        if o_end > o_start:
            total += o_end - o_start
    return total / seg_dur


def generate_cut_list(
    silence_segments: list[dict],
    transcript: dict,
    duration: float,
    intent: EditIntent,
    *,
    audio_silences: list[dict] | None = None,
    min_silence: float = 0.3,
    padding: float = PADDING_S,
    filler_padding: float = 0.075,
    filler_words: set[str] | None = None,
    silence_thresholds: SilenceThresholds | None = None,
    confidence_threshold: int = 2,
    max_pacing_gap: float = 0.7,
) -> tuple[list[EditStep], PipelineLog]:
    """Generate a scored, pacing-optimised edit list.

    Only the features enabled in *intent* are run.

    Returns (steps, log).
    """
    thresholds = silence_thresholds or SilenceThresholds()
    fillers = filler_words if filler_words is not None else FILLER_WORDS
    words = transcript.get("words", [])
    steps: list[EditStep] = []
    log = PipelineLog()

    log.add("intent", "parsed",
            silence_cuts=intent.want_silence_cuts,
            filler_cuts=intent.want_filler_cuts,
            pacing=intent.want_pacing,
            captions=intent.want_captions,
            is_vague=intent.is_vague,
            prompt=repr(intent.raw_prompt[:80]))

    log.add("config", "thresholds",
            keep_below=thresholds.keep_below,
            shorten_below=thresholds.shorten_below,
            shorten_target=thresholds.shorten_target,
            split_above=thresholds.split_above,
            confidence_threshold=confidence_threshold,
            max_pacing_gap=max_pacing_gap,
            padding=padding,
            filler_padding=filler_padding)

    # ------------------------------------------------------------------
    # 1. SILENCE SEGMENTS — decide action per segment
    # ------------------------------------------------------------------
    if intent.want_silence_cuts:
        for seg in silence_segments:
            gap = seg["end"] - seg["start"]
            action = decide_silence_action(gap, thresholds)

            if action == "keep":
                log.silence_skipped(seg["start"], seg["end"], gap,
                                    reason=f"below keep threshold ({thresholds.keep_below}s)")
                continue

            # Compute energy signals when audio silence data is available
            low_energy = False
            overlaps_speech = False
            if audio_silences is not None:
                overlap = _audio_overlap_ratio(seg["start"], seg["end"], audio_silences)
                low_energy = overlap >= 0.7
                overlaps_speech = overlap < 0.3

            sc = score_silence(
                gap,
                has_transcript_gap=True,
                low_energy=low_energy,
                overlaps_speech=overlaps_speech,
            )

            if action == "shorten":
                cut_start, cut_end = compute_shorten_bounds(
                    seg["start"], seg["end"], target=thresholds.shorten_target,
                )
                if cut_end <= cut_start:
                    log.silence_skipped(seg["start"], seg["end"], gap,
                                        reason="shorten bounds collapsed")
                    continue
                log.silence_detected(seg["start"], seg["end"], gap, "shorten", sc.score, sc.reasons)
                steps.append(EditStep(
                    id=str(uuid4()),
                    type="shorten",
                    reason=f"Shortens {gap:.1f}s gap to ~{thresholds.shorten_target}s",
                    start_time=cut_start,
                    end_time=cut_end,
                    confidence=sc.score,
                ))

            elif action == "split":
                padded_start = round(seg["start"] + padding, 3)
                padded_end = round(seg["end"] - padding, 3)
                if padded_end <= padded_start:
                    log.silence_skipped(seg["start"], seg["end"], gap,
                                        reason="padded bounds collapsed")
                    continue
                log.silence_detected(seg["start"], seg["end"], gap, "split", sc.score, sc.reasons)
                steps.append(EditStep(
                    id=str(uuid4()),
                    type="split",
                    reason=f"Clip boundary — {gap:.1f}s silence",
                    start_time=padded_start,
                    end_time=padded_end,
                    confidence=sc.score,
                ))

            else:  # action == "cut"
                padded_start = round(seg["start"] + padding, 3)
                padded_end = round(seg["end"] - padding, 3)
                if padded_end <= padded_start:
                    log.silence_skipped(seg["start"], seg["end"], gap,
                                        reason="padded bounds collapsed")
                    continue
                if sc.score < confidence_threshold:
                    log.silence_skipped(seg["start"], seg["end"], gap,
                                        reason=f"score {sc.score} below threshold {confidence_threshold}")
                    continue
                log.silence_detected(seg["start"], seg["end"], gap, "cut", sc.score, sc.reasons)
                cut_dur = padded_end - padded_start
                steps.append(EditStep(
                    id=str(uuid4()),
                    type="cut_silence",
                    reason=f"Removes {cut_dur:.1f}s of silence",
                    start_time=padded_start,
                    end_time=padded_end,
                    confidence=sc.score,
                ))
    else:
        log.add("intent", "skipped_silence", reason="not requested by user")

    # ------------------------------------------------------------------
    # 2. FILLER WORDS — with padding & neighbour safety
    # ------------------------------------------------------------------
    if intent.want_filler_cuts:
        for idx, word in enumerate(words):
            cleaned = word["word"].lower().strip(".,!?;:'\"")
            if cleaned not in fillers:
                continue

            # Compute neighbour gaps
            gap_before = None
            gap_after = None
            if idx > 0:
                gap_before = word["start"] - words[idx - 1]["end"]
            if idx < len(words) - 1:
                gap_after = words[idx + 1]["start"] - word["end"]

            sc = score_filler(
                cleaned,
                word_confidence=word.get("confidence"),
                neighbor_gap_before=gap_before,
                neighbor_gap_after=gap_after,
            )
            if sc.score < confidence_threshold:
                log.filler_skipped(word["word"], word["start"], word["end"], sc.score,
                                   reason=f"score {sc.score} below threshold {confidence_threshold}")
                continue

            # Apply filler-specific padding
            start = round(max(0, word["start"] - filler_padding), 3)
            end = round(min(duration, word["end"] + filler_padding), 3)

            log.filler_cut(word["word"], start, end, sc.score, sc.reasons)
            steps.append(EditStep(
                id=str(uuid4()),
                type="cut_filler",
                reason=f"Removes filler word: '{word['word']}'",
                start_time=start,
                end_time=end,
                confidence=sc.score,
            ))
    else:
        log.add("intent", "skipped_fillers", reason="not requested by user")

    # ------------------------------------------------------------------
    # 3. PACING OPTIMISATION — shrink remaining large gaps
    # ------------------------------------------------------------------
    if intent.want_pacing:
        pacing_steps = optimize_pacing(words, steps, max_gap=max_pacing_gap)
        for ps in pacing_steps:
            _m = re.search(r"(\d+\.\d+)s gap .* ~(\d+\.\d+)s", ps.reason)
            if _m:
                gb = float(_m.group(1))
                ga = float(_m.group(2))
            else:
                gb = ps.end_time - ps.start_time
                ga = max_pacing_gap
            log.pacing_trimmed(ps.start_time, ps.end_time, gap_before=gb, gap_after=ga)
        steps.extend(pacing_steps)
    else:
        log.add("intent", "skipped_pacing", reason="not requested by user")

    # ------------------------------------------------------------------
    # 4. CAPTIONS — a single marker step that tells execute to burn subs
    # ------------------------------------------------------------------
    if intent.want_captions:
        steps.append(EditStep(
            id=str(uuid4()),
            type="caption",
            reason="Burns captions onto video from transcript",
            start_time=0.0,
            end_time=duration,
            confidence=5,
        ))
        log.add("captions", "added", start=0.0, end=duration)

    # ------------------------------------------------------------------
    # 5. Sort cut/shorten/split steps by start time
    #    Caption steps are kept separate — they're markers, not timeline cuts.
    # ------------------------------------------------------------------
    caption_steps = [s for s in steps if s.type == "caption"]
    cut_steps = [s for s in steps if s.type != "caption"]
    cut_steps.sort(key=lambda s: s.start_time)

    # ------------------------------------------------------------------
    # 6. Merge truly overlapping cuts only (NOT merely touching ones).
    #
    #    BUG FIXED: the previous condition was `<=` which merged adjacent
    #    cuts that only shared a boundary point. This caused a cascade:
    #    silence-cut end == filler-cut start (due to identical padding
    #    values) → merged.  Next silence start == merged cut end → merged
    #    again.  This cascaded through the whole video into one giant cut.
    #
    #    Fix: use strict `<` so cuts must genuinely overlap (not just
    #    touch) to be merged.  Neighbouring speech between two cuts is
    #    preserved correctly.
    # ------------------------------------------------------------------
    merged: list[EditStep] = []
    merge_count = 0
    for step in cut_steps:
        if merged and step.start_time < merged[-1].end_time:  # strict overlap only
            prev = merged[-1]
            # Preserve the more specific type (prefer cut_silence / cut_filler over shorten)
            merged_type = prev.type
            if prev.type == "shorten" and step.type != "shorten":
                merged_type = step.type
            merged[-1] = EditStep(
                id=prev.id,
                type=merged_type,
                reason=f"{prev.reason}; {step.reason}",
                start_time=prev.start_time,
                end_time=max(prev.end_time, step.end_time),
                confidence=max(prev.confidence or 0, step.confidence or 0),
            )
            merge_count += 1
        else:
            merged.append(step)

    log.merge(kept=len(merged), merged=merge_count)

    # Recombine: cut steps first, caption steps appended at the end
    # (captions are shown as a separate card, not mixed in the timeline)
    all_steps = merged + caption_steps

    log.add("summary", "complete", **log.summary())

    return all_steps, log
