"use client";

import { useCallback } from "react";
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
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setZoom = useEditorStore((s) => s.setTimelineZoom);

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
        height: 40,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--bg-border)",
        borderBottom: "1px solid var(--bg-border)",
        padding: "0 12px",
      }}
    >
      {/* Left: Preview toggle + timecode */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center"
          style={{
            background: "var(--bg-elevated)",
            borderRadius: 6,
            padding: 2,
            border: "1px solid var(--bg-border)",
          }}
        >
          <button
            onClick={() => setPreviewMode(false)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: !previewMode
                ? "rgba(255,255,255,.08)"
                : "transparent",
              color: !previewMode ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 120ms ease",
            }}
          >
            Original
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: previewMode ? "rgba(255,106,82,.1)" : "transparent",
              color: previewMode ? "var(--accent)" : "var(--text-muted)",
              transition: "all 120ms ease",
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
