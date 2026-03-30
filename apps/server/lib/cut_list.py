from uuid import uuid4

from lib.step_types import EditStep

FILLER_WORDS = {
    "um", "uh", "uh-huh", "mm", "hmm", "mhm",
    "like", "basically", "literally",
    "actually", "so", "right",
}

# 75ms padding on each side prevents clipped syllables at cut boundaries
PADDING_S = 0.075


def generate_cut_list(
    silence_segments: list[dict],
    transcript: dict,
    duration: float,
    min_silence: float = 0.5,
    padding: float = PADDING_S,
) -> list[EditStep]:
    steps: list[EditStep] = []

    # 1. CUT_SILENCE — apply padding to protect surrounding speech
    for seg in silence_segments:
        raw_gap = seg["end"] - seg["start"]
        if raw_gap <= min_silence:
            continue
        # Shrink cut from both sides by padding amount
        padded_start = round(seg["start"] + padding, 3)
        padded_end = round(seg["end"] - padding, 3)
        if padded_end <= padded_start:
            continue
        cut_dur = padded_end - padded_start
        steps.append(EditStep(
            id=str(uuid4()),
            type="cut_silence",
            reason=f"Removes {cut_dur:.1f}s of silence",
            start_time=padded_start,
            end_time=padded_end,
        ))

    # 2. CUT_FILLER for each filler word
    for word in transcript.get("words", []):
        cleaned = word["word"].lower().strip(".,!?;:'\"")
        if cleaned in FILLER_WORDS:
            steps.append(EditStep(
                id=str(uuid4()),
                type="cut_filler",
                reason=f"Removes filler word: '{word['word']}'",
                start_time=word["start"],
                end_time=word["end"],
            ))

    # 3. Sort by start_time
    steps.sort(key=lambda s: s.start_time)

    # 4. Merge overlapping steps
    merged: list[EditStep] = []
    for step in steps:
        if merged and step.start_time <= merged[-1].end_time:
            prev = merged[-1]
            merged[-1] = EditStep(
                id=prev.id,
                type=prev.type,
                reason=f"{prev.reason}; {step.reason}",
                start_time=prev.start_time,
                end_time=max(prev.end_time, step.end_time),
            )
        else:
            merged.append(step)

    return merged
