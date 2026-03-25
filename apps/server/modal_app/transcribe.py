import os

from modal_app.app import app, image, model_cache, secrets


@app.function(
    image=image,
    gpu="T4",
    volumes={"/cache": model_cache},
    secrets=secrets,
    timeout=600,
)
def transcribe(audio_path: str) -> dict:
    """Run WhisperX transcription with forced alignment. Return words, segments, and SRT."""

    import whisperx

    device = "cuda"
    compute_type = "float16"
    model_dir = "/cache/whisperx"
    os.makedirs(model_dir, exist_ok=True)

    # 1. Transcribe
    model = whisperx.load_model(
        "base",
        device,
        compute_type=compute_type,
        download_root=model_dir,
    )
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=16)

    # 2. Forced alignment for word-level timestamps
    align_model, align_metadata = whisperx.load_align_model(
        language_code=result.get("language", "en"),
        device=device,
    )
    aligned = whisperx.align(
        result["segments"],
        align_model,
        align_metadata,
        audio,
        device,
        return_char_alignments=False,
    )

    words = []
    for seg in aligned.get("segments", []):
        for w in seg.get("words", []):
            words.append({
                "word": w.get("word", ""),
                "start": round(w.get("start", 0.0), 3),
                "end": round(w.get("end", 0.0), 3),
                "score": round(w.get("score", 0.0), 3),
            })

    segments = []
    for seg in aligned.get("segments", []):
        segments.append({
            "text": seg.get("text", ""),
            "start": round(seg.get("start", 0.0), 3),
            "end": round(seg.get("end", 0.0), 3),
        })

    # 3. Build SRT string
    srt_lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        start_srt = _seconds_to_srt(seg["start"])
        end_srt = _seconds_to_srt(seg["end"])
        srt_lines.append(f"{i}")
        srt_lines.append(f"{start_srt} --> {end_srt}")
        srt_lines.append(seg["text"].strip())
        srt_lines.append("")

    return {
        "words": words,
        "segments": segments,
        "srt": "\n".join(srt_lines),
    }


def _seconds_to_srt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
