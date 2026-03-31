"use client";

import { useCallback, useMemo } from "react";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";

function formatTimecode(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${f}`;
}

export function TransportBar({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const videoUrl = useEditorStore((s) => s.videoUrl);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const processedDuration = useEditorStore((s) => s.processedDuration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const steps = useEditorStore((s) => s.steps);
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setZoom = useEditorStore((s) => s.setTimelineZoom);

  // Estimate preview duration from step ranges; use real value from DB when available
  const displayDuration = useMemo(() => {
    if (!previewMode) return duration;
    if (processedDuration != null) return processedDuration;
    // Merge overlapping cut ranges
    const ranges = steps
      .filter((s) => s.status === "approved" || s.status === "pending")
      .map((s) => [s.startTime, s.endTime] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of ranges) {
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(
          merged[merged.length - 1][1],
          e,
        );
      } else {
        merged.push([s, e]);
      }
    }
    const totalRemoved = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
    return duration - totalRemoved;
  }, [previewMode, processedDuration, steps, duration]);

  const togglePlay = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play().catch(() => setIsPlaying(false));
  }, [isPlaying, setIsPlaying, playerRef]);

  const skipBack = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - 5);
    setCurrentTime(el.currentTime);
  }, [playerRef, setCurrentTime]);

  const skipForward = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = Math.min(duration, el.currentTime + 5);
    setCurrentTime(el.currentTime);
  }, [playerRef, duration, setCurrentTime]);

  const disabled = !videoUrl;

  return (
    <div
      className="shrink-0 flex items-center justify-between"
      style={{
        height: 48,
        background: "var(--bg-surface)",
        borderTop: previewMode
          ? "1px solid rgba(255,106,82,.35)"
          : "1px solid var(--bg-border)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 16px",
        boxShadow: previewMode
          ? "inset 0 1px 8px rgba(255,106,82,.08)"
          : "none",
        transition: "border-top 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Left: Preview toggle + timecode */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center"
          style={{
            background: "var(--bg-elevated)",
            borderRadius: 8,
            padding: 3,
            border: "1px solid var(--bg-border)",
            position: "relative",
          }}
        >
          {/* Sliding indicator */}
          <div
            style={{
              position: "absolute",
              top: 3,
              left: previewMode ? "calc(50% + 1px)" : 3,
              width: "calc(50% - 4px)",
              height: "calc(100% - 6px)",
              borderRadius: 5,
              background: previewMode
                ? "linear-gradient(135deg, var(--accent-from), var(--accent-to))"
                : "rgba(255,255,255,.1)",
              boxShadow: previewMode
                ? "0 0 12px rgba(255,106,82,.25)"
                : "0 1px 2px rgba(0,0,0,.3)",
              transition:
                "left 200ms ease, background 200ms ease, box-shadow 200ms ease",
              zIndex: 0,
            }}
          />
          <button
            onClick={() => setPreviewMode(false)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: !previewMode ? 600 : 400,
              padding: "5px 12px",
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: !previewMode ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 150ms ease",
              position: "relative",
              zIndex: 1,
            }}
          >
            Original
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: previewMode ? 600 : 400,
              padding: "5px 12px",
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: previewMode ? "#fff" : "var(--text-muted)",
              transition: "all 150ms ease",
              position: "relative",
              zIndex: 1,
            }}
          >
            Preview
          </button>
        </div>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}
        >
          {formatTimecode(currentTime)}
          <span style={{ color: "var(--text-muted)" }}>
            {" / "}
            {formatTimecode(displayDuration)}
          </span>
        </span>
      </div>

      {/* Centre: Transport */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={skipBack}
          disabled={disabled}
          className="transport-btn"
          title="Back 5s (J)"
        >
          <SkipBack size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={togglePlay}
          disabled={disabled}
          className="transport-btn transport-btn-play"
          title="Play/Pause (Space)"
        >
          {isPlaying ? (
            <Pause size={14} strokeWidth={1.5} />
          ) : (
            <Play size={14} strokeWidth={1.5} style={{ marginLeft: 1 }} />
          )}
        </button>
        <button
          onClick={skipForward}
          disabled={disabled}
          className="transport-btn"
          title="Forward 5s (L)"
        >
          <SkipForward size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Right: Zoom + volume */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setZoom(zoom - 0.5)}
          disabled={zoom <= 1}
          className="transport-btn"
          title="Zoom out"
        >
          <ZoomOut size={14} strokeWidth={1.5} />
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            minWidth: 36,
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.5)}
          disabled={zoom >= 20}
          className="transport-btn"
          title="Zoom in"
        >
          <ZoomIn size={14} strokeWidth={1.5} />
        </button>
        <Volume2
          size={14}
          strokeWidth={1.5}
          style={{ color: "var(--text-muted)", marginLeft: 4 }}
        />
      </div>
    </div>
  );
}
