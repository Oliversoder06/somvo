import ffmpeg


def extract_audio(video_path: str, output_path: str) -> str:
    """Extract audio as 16 kHz mono WAV from a video file."""
    (
        ffmpeg
        .input(video_path)
        .output(output_path, vn=None, acodec="pcm_s16le", ar=16000, ac=1)
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def cut_silence(video_path: str, silence_segments: list[dict], output_path: str) -> str:
    """Remove silence segments from a video using per-segment seek + concat."""
    if not silence_segments:
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    # Build keep segments (inverse of silence)
    probe = ffmpeg.probe(video_path)
    duration = float(probe["format"]["duration"])

    keep: list[tuple[float, float]] = []
    prev = 0.0
    for seg in sorted(silence_segments, key=lambda s: s["start"]):
        if seg["start"] > prev:
            keep.append((prev, seg["start"]))
        prev = seg["end"]
    if prev < duration:
        keep.append((prev, duration))

    if not keep:
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    # Seek into the source file once per keep-segment and concat.
    # This guarantees audio and video are cut at the same boundaries
    # and avoids the timestamp drift of select/aselect + setpts/asetpts.
    segments = []
    for start, end in keep:
        seg = ffmpeg.input(video_path, ss=start, t=end - start)
        segments.extend([seg.video, seg.audio])

    joined = ffmpeg.concat(*segments, v=1, a=1).node
    v_out = joined[0]
    a_out = joined[1].filter("highpass", f=20)  # Remove DC offset clicks at splice points

    (
        ffmpeg
        .output(v_out, a_out, output_path)
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def burn_captions(video_path: str, srt_path: str, output_path: str) -> str:
    """Burn SRT captions into a video using the subtitles filter."""
    # Escape colons and backslashes in path for FFmpeg subtitles filter
    escaped_path = srt_path.replace("\\", "\\\\").replace(":", "\\:")
    (
        ffmpeg
        .input(video_path)
        .output(output_path, vf=f"subtitles={escaped_path}")
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def apply_watermark(video_path: str, watermark_path: str, output_path: str) -> str:
    """Overlay a watermark image in the bottom-right corner."""
    main = ffmpeg.input(video_path)
    logo = ffmpeg.input(watermark_path)
    (
        ffmpeg
        .filter([main, logo], "overlay", "W-w-10", "H-h-10")
        .output(output_path)
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def cap_resolution(video_path: str, output_path: str, max_height: int = 720) -> str:
    """Scale video down to max_height if it exceeds it, preserving aspect ratio."""
    probe = ffmpeg.probe(video_path)
    video_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "video"), None
    )
    if video_stream and int(video_stream.get("height", 0)) <= max_height:
        import shutil
        shutil.copy2(video_path, output_path)
        return output_path

    (
        ffmpeg
        .input(video_path)
        .output(
            output_path,
            vf=f"scale=-2:{max_height}",
        )
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def concat_segments(segment_paths: list[str], output_path: str) -> str:
    """Concatenate multiple video files using the FFmpeg concat demuxer."""
    import tempfile
    import os

    list_file = os.path.join(tempfile.gettempdir(), "concat_list.txt")
    with open(list_file, "w") as f:
        for p in segment_paths:
            f.write(f"file '{p}'\n")

    (
        ffmpeg
        .input(list_file, format="concat", safe=0)
        .output(output_path, c="copy")
        .overwrite_output()
        .run(quiet=True)
    )

    os.remove(list_file)
    return output_path
