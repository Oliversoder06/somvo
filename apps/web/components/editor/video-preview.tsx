"use client";

import { useCallback } from "react";
import ReactPlayer from "react-player";
import { Play, Pause, Loader2, Maximize2, Volume2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
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

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
    const el = playerRef.current;
    if (el) {
      if (isPlaying) el.pause();
      else el.play();
    }
  }, [isPlaying, setIsPlaying, playerRef]);

  const isProcessing = status === "uploading" || status === "processing";
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Video area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {videoUrl && (
          <ReactPlayer
            ref={(el) => {
              if (el instanceof HTMLVideoElement) {
                playerRef.current = el;
              }
            }}
            src={videoUrl}
            autoPlay={isPlaying}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => setIsPlaying(false)}
            width="100%"
            height="100%"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              objectFit: "contain",
            }}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-base/90">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
                  <Loader2
                    size={24}
                    strokeWidth={1.5}
                    className="text-info animate-spin"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="font-display text-[13px] font-semibold text-fg mb-1">
                  {status === "uploading" ? "Uploading…" : "Processing…"}
                </p>
                <p className="font-mono text-[11px] text-fg-muted">
                  {status === "uploading"
                    ? "Uploading your video"
                    : "Analysing audio, detecting silence"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No video placeholder */}
        {!videoUrl && !isProcessing && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full border border-border flex items-center justify-center">
              <Play
                size={20}
                strokeWidth={1.5}
                className="text-fg-muted ml-0.5"
              />
            </div>
            <p className="font-mono text-[11px] text-fg-muted">
              No video loaded
            </p>
          </div>
        )}
      </div>

      {/* Transport bar */}
      <div className="shrink-0 border-t border-border bg-surface">
        {/* Scrubber track */}
        <div
          className="h-1 w-full bg-elevated relative cursor-pointer group"
          onClick={(e) => {
            if (duration <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const newTime = pct * duration;
            if (playerRef.current) playerRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }}
        >
          <div
            className="absolute top-0 left-0 h-full bg-accent transition-[width] duration-75"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPercent}%`, marginLeft: -5 }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          <button
            onClick={togglePlay}
            disabled={!videoUrl}
            className="flex items-center justify-center w-7 h-7 rounded-md text-fg-secondary hover:text-fg transition-colors disabled:opacity-30"
          >
            {isPlaying ? (
              <Pause size={14} strokeWidth={1.5} />
            ) : (
              <Play size={14} strokeWidth={1.5} />
            )}
          </button>

          <span className="font-mono text-[11px] text-fg-secondary tabular-nums">
            {formatTime(currentTime)}
            <span className="text-fg-muted mx-1">/</span>
            {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <button className="flex items-center justify-center w-7 h-7 rounded-md text-fg-muted hover:text-fg-secondary transition-colors">
            <Volume2 size={13} strokeWidth={1.5} />
          </button>
          <button className="flex items-center justify-center w-7 h-7 rounded-md text-fg-muted hover:text-fg-secondary transition-colors">
            <Maximize2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
