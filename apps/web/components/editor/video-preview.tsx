"use client";

import { useEffect } from "react";
import { Play, Loader2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { CaptionOverlay } from "./caption-overlay";
import { CaptionStylePanel } from "./caption-style-panel";

export function VideoPreview({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const videoUrl = useEditorStore((s) => s.videoUrl);
  const status = useEditorStore((s) => s.status);
  const currentTime = useEditorStore((s) => s.currentTime);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setDuration = useEditorStore((s) => s.setDuration);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const steps = useEditorStore((s) => s.steps);

  // Preview mode: skip over approved cuts during playback
  useEffect(() => {
    if (!previewMode) return;
    const active = steps.filter(
      (s) => s.status === "approved" || s.status === "pending",
    );
    const inside = active.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime,
    );
    if (inside && playerRef.current) {
      playerRef.current.currentTime = inside.endTime;
    }
  }, [currentTime, previewMode, steps, playerRef]);

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div
      className="flex-1 relative flex items-center justify-center overflow-hidden"
      style={{
        background: "#000",
      }}
    >
      {/* Preview mode badge */}
      {previewMode && videoUrl && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,106,82,.15)",
            border: "1px solid rgba(255,106,82,.3)",
            borderRadius: 6,
            padding: "4px 10px",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 6px var(--accent)",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--accent)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Preview — cuts skipped
          </span>
        </div>
      )}

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

      {/* Caption overlay + style panel */}
      {videoUrl && <CaptionOverlay />}
      {videoUrl && <CaptionStylePanel />}

      {isProcessing && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10"
          style={{ background: "rgba(9,6,8,.92)" }}
        >
          <Loader2
            size={28}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ color: "var(--accent)" }}
          />
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 14,
              letterSpacing: "0.04em",
            }}
          >
            {status === "uploading" ? "Uploading..." : "Processing..."}
          </p>
        </div>
      )}

      {!videoUrl &&
        !isProcessing &&
        (status === "ready" || status === "done") && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2
              size={24}
              strokeWidth={1.5}
              className="animate-spin"
              style={{ color: "var(--accent)" }}
            />
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.02em",
              }}
            >
              Loading video...
            </p>
          </div>
        )}

      {!videoUrl &&
        !isProcessing &&
        status !== "ready" &&
        status !== "done" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(255,255,255,.04)",
                border: "1px solid var(--bg-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play
                size={18}
                strokeWidth={1.5}
                style={{ color: "var(--text-muted)", marginLeft: 2 }}
              />
            </div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.02em",
              }}
            >
              No video loaded
            </p>
          </div>
        )}
    </div>
  );
}
