def derive_silence_from_words(
    words: list[dict], min_silence: float = 0.5
) -> list[dict]:
    """
    Derive silence segments from gaps between words.
    No VAD needed — silence is just the space between spoken words.
    """
    silences = []

    for i in range(1, len(words)):
        gap_start = words[i - 1]["end"]
        gap_end = words[i]["start"]
        gap = gap_end - gap_start

        if gap >= min_silence:
            silences.append(
                {
                    "start": round(gap_start, 3),
                    "end": round(gap_end, 3),
                }
            )

    return silences
