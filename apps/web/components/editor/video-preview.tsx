"use client";

import { useCallback, useEffect } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

function formatTimecode(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export function VideoPreview({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const videoUrl = useEditorStore((s) => s.videoUrl);
  const status = useEditorStore((s) => s.status);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setDuration = useEditorStore((s) => s.setDuration);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const steps = useEditorStore((s) => s.steps);

  const togglePlay = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(() => setIsPlaying(false));
    }
  }, [isPlaying, setIsPlaying, playerRef]);

  // Preview mode: skip over approved cuts during playback
  useEffect(() => {
    if (!previewMode) return;
    const acceptedCuts = steps.filter((s) => s.status === "approved");
    const insideCut = acceptedCuts.find(
      (cut) => currentTime >= cut.startTime && currentTime < cut.endTime,
    );
    if (insideCut) {
      playerRef.current?.currentTime &&
        (playerRef.current.currentTime = insideCut.endTime);
    }
  }, [currentTime, previewMode, steps, playerRef]);

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Video area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {videoUrl && (
          <video
            key={videoUrl}
            ref={playerRef}
            src={videoUrl}
            preload="auto"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error(
                "[Somvo] Video load error:",
                e.currentTarget.error?.message,
                "src:",
                videoUrl,
              );
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-base/90">
            <div className="flex flex-col items-center gap-4">
              <Loader2
                size={24}
                strokeWidth={1.5}
                className="text-info animate-spin"
              />
              <p className="font-mono text-[12px] text-fg-muted">
                {status === "uploading" ? "Uploading…" : "Processing…"}
              </p>
            </div>
          </div>
        )}

        {/* No video placeholder */}
        {!videoUrl && !isProcessing && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Play size={24} strokeWidth={1.5} className="text-fg-muted" />
            <p className="font-mono text-[11px] text-fg-muted">
              No video loaded
            </p>
          </div>
        )}
      </div>

      {/* ── Transport bar ────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-surface">
        <div className="flex items-center h-10 px-3 gap-3">
          {/* Left: play + timecode */}
          <button
            onClick={togglePlay}
            disabled={!videoUrl}
            className="flex items-center justify-center w-7 h-7 rounded-md text-fg-secondary hover:text-fg transition-colors disabled:opacity-30"
          >
            {isPlaying ? (
              <Pause size={15} strokeWidth={1.5} />
            ) : (
              <Play size={15} strokeWidth={1.5} />
            )}
          </button>
          <span className="font-mono text-[12px] text-fg-secondary tabular-nums tracking-wide">
            {formatTimecode(currentTime)}
          </span>

          <div className="flex-1" />

          {/* Center: Original / Preview toggle */}
          <div className="flex items-center gap-1 bg-elevated rounded-md p-0.5">
            <button
              onClick={() => setPreviewMode(false)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                !previewMode
                  ? "bg-surface text-fg"
                  : "text-fg-muted hover:text-fg-secondary"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                previewMode
                  ? "bg-surface text-fg"
                  : "text-fg-muted hover:text-fg-secondary"
              }`}
            >
              Preview
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: zoom */}
          <span className="font-mono text-[11px] text-fg-muted">100%</span>
        </div>
      </div>
    </div>
  );
}
