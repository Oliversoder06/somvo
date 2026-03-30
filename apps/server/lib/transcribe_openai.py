import os
import subprocess
import tempfile
from openai import OpenAI


def _extract_audio(video_path: str) -> str:
    """Extract audio as compressed m4a. Returns path to temp audio file."""
    audio_path = video_path.rsplit(".", 1)[0] + ".m4a"
    subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "aac", "-b:a", "64k", "-ac", "1",
            "-y", audio_path,
        ],
        capture_output=True,
        check=True,
    )
    return audio_path


def transcribe_video(video_path: str) -> dict:
    """
    Transcribe video using OpenAI Whisper API.
    Extracts audio first to stay under the 25 MB upload limit.
    Returns word-level timestamps and SRT string.
    """
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    audio_path = _extract_audio(video_path)

    try:
        with open(audio_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)

    words = [
        {
            "word": w.word,
            "start": w.start,
            "end": w.end,
        }
        for w in response.words
    ]

    segments = response.segments or []
    srt = generate_srt(segments)

    return {
        "words": words,
        "segments": [
            {"text": s.text, "start": s.start, "end": s.end} for s in segments
        ],
        "srt": srt,
    }


def generate_srt(segments) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_srt_time(seg.start)
        end = format_srt_time(seg.end)
        lines.append(f"{i}\n{start} --> {end}\n{seg.text.strip()}\n")
    return "\n".join(lines)


def format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
