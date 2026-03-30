import re
from uuid import uuid4

from lib.edit_decision import (
    SilenceThresholds,
    compute_shorten_bounds,
    decide_silence_action,
)
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

    Pipeline: detect → score → decide → optimise pacing → merge → return.

    Returns (steps, log) — the log contains a structured trace of every
    decision for full auditability.
    """
    thresholds = silence_thresholds or SilenceThresholds()
    fillers = filler_words if filler_words is not None else FILLER_WORDS
    words = transcript.get("words", [])
    steps: list[EditStep] = []
    log = PipelineLog()

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
    for seg in silence_segments:
        gap = seg["end"] - seg["start"]
        action = decide_silence_action(gap, thresholds)

        if action == "keep":
            log.silence_skipped(seg["start"], seg["end"], gap, reason=f"below keep threshold ({thresholds.keep_below}s)")
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
                log.silence_skipped(seg["start"], seg["end"], gap, reason="shorten bounds collapsed")
                continue
            cut_dur = cut_end - cut_start
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
                log.silence_skipped(seg["start"], seg["end"], gap, reason="padded bounds collapsed")
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
                log.silence_skipped(seg["start"], seg["end"], gap, reason="padded bounds collapsed")
                continue
            cut_dur = padded_end - padded_start
            if sc.score < confidence_threshold:
                log.silence_skipped(seg["start"], seg["end"], gap, reason=f"score {sc.score} below threshold {confidence_threshold}")
                continue
            log.silence_detected(seg["start"], seg["end"], gap, "cut", sc.score, sc.reasons)
            steps.append(EditStep(
                id=str(uuid4()),
                type="cut_silence",
                reason=f"Removes {cut_dur:.1f}s of silence",
                start_time=padded_start,
                end_time=padded_end,
                confidence=sc.score,
            ))

    # ------------------------------------------------------------------
    # 2. FILLER WORDS — with padding & neighbour safety
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 3. PACING OPTIMISATION — shrink remaining large gaps
    # ------------------------------------------------------------------
    pacing_steps = optimize_pacing(words, steps, max_gap=max_pacing_gap)
    for ps in pacing_steps:
        # Extract original gap size and target from the reason string
        # Reason format: "Pacing: {gap_dur:.2f}s gap → ~{target}s"
        _m = re.search(r"(\d+\.\d+)s gap .* ~(\d+\.\d+)s", ps.reason)
        if _m:
            gap_before = float(_m.group(1))
            gap_after = float(_m.group(2))
        else:
            gap_before = ps.end_time - ps.start_time
            gap_after = max_pacing_gap
        log.pacing_trimmed(ps.start_time, ps.end_time,
                           gap_before=gap_before,
                           gap_after=gap_after)
    steps.extend(pacing_steps)

    # ------------------------------------------------------------------
    # 4. Sort + merge overlapping
    # ------------------------------------------------------------------
    steps.sort(key=lambda s: s.start_time)

    merged: list[EditStep] = []
    merge_count = 0
    for step in steps:
        if merged and step.start_time <= merged[-1].end_time:
            prev = merged[-1]
            merged[-1] = EditStep(
                id=prev.id,
                type=prev.type if prev.type != "shorten" else step.type,
                reason=f"{prev.reason}; {step.reason}",
                start_time=prev.start_time,
                end_time=max(prev.end_time, step.end_time),
                confidence=max(prev.confidence or 0, step.confidence or 0),
            )
            merge_count += 1
        else:
            merged.append(step)

    log.merge(kept=len(merged), merged=merge_count)
    log.add("summary", "complete", **log.summary())

    return merged, log
