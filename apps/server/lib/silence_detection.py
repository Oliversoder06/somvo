import subprocess


def derive_silence_from_words(
    words: list[dict], min_silence: float = 0.3
) -> list[dict]:
    """Derive silence segments from gaps between consecutive transcript words."""
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


def detect_silence_ffmpeg(
    video_path: str,
    noise_db: float = -35.0,
    min_silence: float = 0.5,
) -> list[dict]:
    """Detect silence using FFmpeg's silencedetect filter (audio energy based)."""
    cmd = [
        "ffmpeg", "-i", video_path, "-vn",
        "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    silences = []
    current_start = None
    for line in result.stderr.splitlines():
        if "silence_start:" in line:
            try:
                current_start = float(
                    line.split("silence_start:")[1].strip().split()[0]
                )
            except (IndexError, ValueError):
                current_start = None
        elif "silence_end:" in line and current_start is not None:
            try:
                end = float(
                    line.split("silence_end:")[1].strip().split()[0]
                )
                silences.append({
                    "start": round(current_start, 3),
                    "end": round(end, 3),
                })
            except (IndexError, ValueError):
                pass
            current_start = None
    return silences


def cross_validate_silence(
    transcript_silences: list[dict],
    audio_silences: list[dict],
    min_overlap_ratio: float = 0.3,
) -> list[dict]:
    """
    Keep transcript silence segments confirmed by audio energy analysis.
    A segment passes if at least min_overlap_ratio of the transcript gap
    overlaps with audio-detected silence regions.
    """
    validated = []
    for ts in transcript_silences:
        ts_start, ts_end = ts["start"], ts["end"]
        ts_dur = ts_end - ts_start
        if ts_dur <= 0:
            continue

        total_overlap = 0.0
        for au in audio_silences:
            o_start = max(ts_start, au["start"])
            o_end = min(ts_end, au["end"])
            if o_end > o_start:
                total_overlap += o_end - o_start

        if total_overlap / ts_dur >= min_overlap_ratio:
            validated.append({"start": ts_start, "end": ts_end})

    return validated


def detect_silence_combined(
    video_path: str,
    words: list[dict],
    min_silence: float = 0.3,
    noise_db: float = -35.0,
) -> list[dict]:
    """
    Cross-validate transcript word gaps with FFmpeg audio energy detection.
    Only cuts regions where both transcript gaps AND audio energy agree
    there is silence, eliminating false positives from transcript timing drift.
    Falls back to transcript-only if audio detection fails.
    """
    transcript_silences = derive_silence_from_words(words, min_silence)

    try:
        audio_silences = detect_silence_ffmpeg(video_path, noise_db, min_silence)
        if audio_silences:
            return cross_validate_silence(transcript_silences, audio_silences)
    except Exception:
        pass

    return transcript_silences
