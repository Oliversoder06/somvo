from uuid import uuid4

from lib.step_types import EditStep

FILLER_WORDS = [
    "um", "uh", "like", "you know", "basically",
    "literally", "actually", "so", "right",
]


def generate_cut_list(
    silence_segments: list[dict],
    transcript: dict,
    duration: float,
) -> list[EditStep]:
    steps: list[EditStep] = []

    # 1. CUT_SILENCE for each silence segment > 0.5s
    for seg in silence_segments:
        gap = seg["end"] - seg["start"]
        if gap > 0.5:
            steps.append(EditStep(
                id=str(uuid4()),
                type="cut_silence",
                reason=f"Removes {gap:.1f}s of silence",
                start_time=seg["start"],
                end_time=seg["end"],
            ))

    # 2. CUT_FILLER for each filler word
    for word in transcript.get("words", []):
        cleaned = word["word"].lower().strip(".,!?")
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
