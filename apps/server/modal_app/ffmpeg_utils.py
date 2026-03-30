import ffmpeg
import os
import shutil
import tempfile


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
        shutil.copy2(video_path, output_path)
        return output_path

    # Delegate to the robust two-pass renderer
    _render_keep_segments(video_path, keep, output_path)
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
    logo = ffmpeg.input(watermark_path, loop=1, framerate=25)
    overlaid = ffmpeg.filter([main.video, logo.video], "overlay", "W-w-10", "H-h-10", shortest=1)
    (
        ffmpeg
        .output(overlaid, main.audio, output_path)
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


# ---------------------------------------------------------------------------
# Smart edit execution (supports cut / shorten / split)
# ---------------------------------------------------------------------------

def execute_edit_steps(
    video_path: str,
    steps: list[dict],
    work_dir: str,
) -> list[str]:
    """Apply approved edit steps and return paths to output clip(s).

    Parameters
    ----------
    video_path : str
        Path to the source video.
    steps : list[dict]
        Each dict must have ``type``, ``start_time``, ``end_time``.
        Types handled: ``cut_silence``, ``cut_filler``, ``shorten``, ``split``, ``trim``.
    work_dir : str
        Temporary directory for intermediate files.

    Returns
    -------
    list[str]
        One path per output clip.  Usually a single item unless split
        boundaries were present.
    """
    probe = ffmpeg.probe(video_path)
    duration = float(probe["format"]["duration"])

    # Separate split boundaries from removal segments
    removals: list[tuple[float, float]] = []
    split_points: list[float] = []

    for s in sorted(steps, key=lambda x: x["start_time"]):
        stype = s["type"]
        if stype == "split":
            # The midpoint of the split silence is the boundary
            mid = (s["start_time"] + s["end_time"]) / 2
            split_points.append(mid)
            # Also remove the silence itself
            removals.append((s["start_time"], s["end_time"]))
        elif stype in ("cut_silence", "cut_filler", "shorten", "trim"):
            removals.append((s["start_time"], s["end_time"]))

    # Merge overlapping removals
    removals.sort()
    merged_removals: list[tuple[float, float]] = []
    for start, end in removals:
        if merged_removals and start <= merged_removals[-1][1]:
            merged_removals[-1] = (merged_removals[-1][0], max(merged_removals[-1][1], end))
        else:
            merged_removals.append((start, end))

    # Build keep segments (inverse of removals)
    keep: list[tuple[float, float]] = []
    prev = 0.0
    for rs, re in merged_removals:
        if rs > prev:
            keep.append((prev, rs))
        prev = re
    if prev < duration:
        keep.append((prev, duration))

    if not keep:
        # Nothing to keep — return copy of original
        out = os.path.join(work_dir, "output_clip_0.mp4")
        shutil.copy2(video_path, out)
        return [out]

    # Determine clip boundaries based on split points
    # Map split_points to positions in the *keep* timeline
    if not split_points:
        # Single clip — render all keep segments
        out = os.path.join(work_dir, "output_clip_0.mp4")
        _render_keep_segments(video_path, keep, out)
        return [out]

    # Partition keep segments into clips at split boundaries
    clips: list[list[tuple[float, float]]] = []
    current_clip: list[tuple[float, float]] = []
    sp_idx = 0

    for seg_start, seg_end in keep:
        while sp_idx < len(split_points) and split_points[sp_idx] <= seg_start:
            if current_clip:
                clips.append(current_clip)
                current_clip = []
            sp_idx += 1

        if sp_idx < len(split_points) and seg_start < split_points[sp_idx] < seg_end:
            # Split point falls inside this keep segment
            boundary = split_points[sp_idx]
            if boundary - seg_start > 0.05:
                current_clip.append((seg_start, boundary))
            if current_clip:
                clips.append(current_clip)
                current_clip = []
            if seg_end - boundary > 0.05:
                current_clip.append((boundary, seg_end))
            sp_idx += 1
        else:
            current_clip.append((seg_start, seg_end))

    if current_clip:
        clips.append(current_clip)

    # Render each clip
    output_paths: list[str] = []
    for i, clip_segs in enumerate(clips):
        if not clip_segs:
            continue
        out = os.path.join(work_dir, f"output_clip_{i}.mp4")
        _render_keep_segments(video_path, clip_segs, out)
        output_paths.append(out)

    return output_paths or [video_path]


def _render_keep_segments(
    video_path: str,
    keep: list[tuple[float, float]],
    output_path: str,
) -> str:
    """Concat *keep* intervals from *video_path* into *output_path*.

    Uses a two-pass approach for reliability:
      1. Extract each keep segment to a temp file (accurate seeking).
      2. Join with the concat demuxer (fast, lossless join).
    This avoids the unreliable N-input concat filter graph that can
    silently truncate output when the segment count is high.
    """
    if not keep:
        shutil.copy2(video_path, output_path)
        return output_path

    if len(keep) == 1:
        start, end = keep[0]
        seg = ffmpeg.input(video_path, ss=start, t=end - start)
        a_out = seg.audio.filter("highpass", f=20)
        (
            ffmpeg
            .output(seg.video, a_out, output_path)
            .overwrite_output()
            .run(quiet=True)
        )
        return output_path

    work_dir = os.path.dirname(output_path)
    segment_paths: list[str] = []

    # Pass 1: extract each keep segment to its own file
    for i, (start, end) in enumerate(keep):
        seg_path = os.path.join(work_dir, f"_seg_{i}.mp4")
        seg = ffmpeg.input(video_path, ss=start, t=end - start)
        a_out = seg.audio.filter("highpass", f=20)
        (
            ffmpeg
            .output(seg.video, a_out, seg_path)
            .overwrite_output()
            .run(quiet=True)
        )
        segment_paths.append(seg_path)

    # Pass 2: join with concat demuxer (stream-copy, no re-encode)
    list_file = os.path.join(work_dir, "_concat_list.txt")
    with open(list_file, "w") as f:
        for p in segment_paths:
            safe = p.replace("'", "'\\''")
            f.write(f"file '{safe}'\n")

    (
        ffmpeg
        .input(list_file, format="concat", safe=0)
        .output(output_path, c="copy")
        .overwrite_output()
        .run(quiet=True)
    )

    # Validate output duration
    expected = sum(end - start for start, end in keep)
    try:
        probe = ffmpeg.probe(output_path)
        actual = float(probe["format"]["duration"])
        if actual < expected * 0.85:
            raise RuntimeError(
                f"Concat produced {actual:.1f}s but expected ~{expected:.1f}s "
                f"({len(keep)} segments). Output may be truncated."
            )
    except (KeyError, ValueError):
        pass  # probe failed — let downstream handle it

    # Cleanup temp segments
    for p in segment_paths:
        try:
            os.remove(p)
        except OSError:
            pass
    try:
        os.remove(list_file)
    except OSError:
        pass

    return output_path
