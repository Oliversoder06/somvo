import os
from openai import OpenAI


def transcribe_video(video_path: str) -> dict:
    """
    Transcribe video using OpenAI Whisper API.
    Returns word-level timestamps and SRT string.
    """
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    with open(video_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

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
