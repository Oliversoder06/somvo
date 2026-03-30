from modal_app.app import app, image, model_cache, secrets


@app.function(
    image=image,
    gpu="T4",
    volumes={"/cache": model_cache},
    secrets=secrets,
)
def detect_silence(
    audio_path: str,
    threshold: float = 0.5,
    min_silence_duration: float = 0.5,
) -> list[dict]:
    """Run Silero VAD on an audio file and return silence segments."""
    import torch
    import torchaudio

    SAMPLING_RATE = 16000

    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
        onnx=False,
    )

    (get_speech_timestamps, _, read_audio, *_) = utils

    wav = read_audio(audio_path, sampling_rate=SAMPLING_RATE)

    speech_timestamps = get_speech_timestamps(
        wav,
        model,
        sampling_rate=SAMPLING_RATE,
        threshold=threshold,
        return_seconds=True,
    )

    # Derive silence segments from gaps between speech segments
    audio_info = torchaudio.info(audio_path)
    total_duration = audio_info.num_frames / audio_info.sample_rate

    silence_segments: list[dict] = []
    prev_end = 0.0

    for ts in speech_timestamps:
        gap_start = prev_end
        gap_end = ts["start"]
        if gap_end - gap_start >= min_silence_duration:
            silence_segments.append({"start": round(gap_start, 3), "end": round(gap_end, 3)})
        prev_end = ts["end"]

    # Trailing silence
    if total_duration - prev_end >= min_silence_duration:
        silence_segments.append({"start": round(prev_end, 3), "end": round(total_duration, 3)})

    return silence_segments
