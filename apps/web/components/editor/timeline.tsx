"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";

function formatRulerTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Video filmstrip: capture frames from <video> onto a canvas ── */
function useFilmstrip(
  playerRef: React.MutableRefObject<HTMLVideoElement | null>,
  duration: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const el = playerRef.current;
    const container = containerRef.current;
    if (!el || !container || duration <= 0 || !el.src) return;

    const containerWidth = container.clientWidth;
    const thumbHeight = 48;
    const thumbWidth = 80;
    const count = Math.max(1, Math.floor(containerWidth / thumbWidth));

    const canvas = document.createElement("canvas");
    canvas.width = containerWidth;
    canvas.height = thumbHeight;

    let cancelled = false;

    const offscreen = document.createElement("video");
    offscreen.crossOrigin = "anonymous";
    offscreen.muted = true;
    offscreen.preload = "auto";
    offscreen.src = el.src;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    async function extractFrames() {
      await new Promise<void>((resolve, reject) => {
        if (offscreen.readyState >= 2) return resolve();
        offscreen.addEventListener("loadeddata", () => resolve(), {
          once: true,
        });
        offscreen.addEventListener("error", () => reject(), { once: true });
      });

      const sliceWidth = containerWidth / count;

      for (let i = 0; i < count; i++) {
        if (cancelled) return;
        const seekTime = (i / count) * duration + duration / count / 2;
        offscreen.currentTime = Math.min(seekTime, duration - 0.1);
        await new Promise<void>((resolve) => {
          offscreen.addEventListener("seeked", () => resolve(), { once: true });
        });
        if (cancelled) return;
        ctx.drawImage(offscreen, i * sliceWidth, 0, sliceWidth, thumbHeight);
      }

      if (!cancelled && container) {
        container.style.backgroundImage = `url(${canvas.toDataURL("image/jpeg", 0.6)})`;
        container.style.backgroundSize = "100% 100%";
        container.style.backgroundRepeat = "no-repeat";
      }
    }

    extractFrames().catch(() => {});

    return () => {
      cancelled = true;
      offscreen.src = "";
    };
  }, [playerRef, duration, containerRef]);
}

/* ── Audio waveform via WaveSurfer.js ── */
function useWaveform(
  playerRef: React.MutableRefObject<HTMLVideoElement | null>,
  duration: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const wsRef = useRef<unknown>(null);

  useEffect(() => {
    const el = playerRef.current;
    const container = containerRef.current;
    if (!el || !container || duration <= 0 || !el.src) return;

    let ws: { destroy: () => void } | null = null;

    async function initWaveSurfer() {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;
        ws = WaveSurfer.create({
          container,
          height: "auto",
          waveColor: "#3f3f46",
          progressColor: "#71717a",
          cursorWidth: 0,
          barWidth: 2,
          barGap: 1,
          barRadius: 1,
          normalize: true,
          interact: false,
          media: el,
        });
        wsRef.current = ws;
      } catch {
        // WaveSurfer init failed
      }
    }

    initWaveSurfer();

    return () => {
      if (ws) ws.destroy();
      wsRef.current = null;
    };
  }, [playerRef, duration, containerRef]);
}

export function Timeline({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const steps = useEditorStore((s) => s.steps);
  const duration = useEditorStore((s) => s.duration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const updateStepBounds = useEditorStore((s) => s.updateStepBounds);

  const waveformRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const videoPlayheadRef = useRef<HTMLDivElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);

  // Smooth playhead: read video.currentTime at ~60fps via rAF
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const el = playerRef.current;
      if (el && duration > 0) {
        const pct = `${(el.currentTime / duration) * 100}%`;
        if (videoPlayheadRef.current) videoPlayheadRef.current.style.left = pct;
        if (audioPlayheadRef.current) audioPlayheadRef.current.style.left = pct;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playerRef, duration]);

  const [dragState, setDragState] = useState<{
    stepId: string;
    edge: "left" | "right";
  } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useFilmstrip(playerRef, duration, filmstripRef);
  useWaveform(playerRef, duration, waveformRef);

  const rulerTicks = useMemo(() => {
    if (duration <= 0) return [];
    const interval = duration <= 30 ? 5 : duration <= 120 ? 15 : 30;
    const ticks: { time: number; label: string; percent: number }[] = [];
    for (let t = 0; t <= duration; t += interval) {
      ticks.push({
        time: t,
        label: formatRulerTime(t),
        percent: (t / duration) * 100,
      });
    }
    return ticks;
  }, [duration]);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0 || dragState) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, pct * duration));
      if (playerRef.current) playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration, playerRef, setCurrentTime, dragState],
  );

  const handleSegmentClick = useCallback(
    (e: React.MouseEvent, step: (typeof steps)[0]) => {
      e.stopPropagation();
      const el = playerRef.current;
      if (!el) return;
      const seekTo = step.startTime;
      el.currentTime = seekTo;
      setCurrentTime(seekTo);
      el.play().catch(() => {});
      const endAt = step.endTime;
      let rafId: number;
      const checkPause = () => {
        if (el.paused || el.currentTime >= endAt) {
          el.pause();
          el.currentTime = endAt;
          return;
        }
        rafId = requestAnimationFrame(checkPause);
      };
      rafId = requestAnimationFrame(checkPause);
    },
    [playerRef, setCurrentTime],
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent, stepId: string, edge: "left" | "right") => {
      e.stopPropagation();
      e.preventDefault();
      setDragState({ stepId, edge });

      const trackEl = e.currentTarget.closest(
        "[data-timeline-track]",
      ) as HTMLElement;
      if (!trackEl) return;

      const onMouseMove = (ev: MouseEvent) => {
        const rect = trackEl.getBoundingClientRect();
        const pct = (ev.clientX - rect.left) / rect.width;
        const time = Math.max(0, Math.min(duration, pct * duration));
        const step = useEditorStore
          .getState()
          .steps.find((s) => s.id === stepId);
        if (!step) return;

        if (edge === "left") {
          updateStepBounds(
            stepId,
            Math.min(time, step.endTime - 0.1),
            step.endTime,
          );
        } else {
          updateStepBounds(
            stepId,
            step.startTime,
            Math.max(time, step.startTime + 0.1),
          );
        }
      };

      const onMouseUp = () => {
        setDragState(null);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [duration, updateStepBounds],
  );

  /* ── Cut regions on tracks: dimmed overlay so cut section looks "removed" ── */
  const renderTrackCutRegions = () =>
    steps.map((step) => {
      if (duration <= 0) return null;
      const leftPct = (step.startTime / duration) * 100;
      const widthPct = ((step.endTime - step.startTime) / duration) * 100;
      const isRejected = step.status === "rejected";
      const isApproved = step.status === "approved";

      // Rejected = skip rendering, approved = darkened, pending = lightly darkened
      if (isRejected) return null;

      return (
        <div
          key={`region-${step.id}`}
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: isApproved
              ? "rgba(0, 0, 0, 0.55)"
              : "rgba(0, 0, 0, 0.35)",
          }}
        >
          {/* Left edge accent */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px"
            style={{
              background: "var(--danger)",
              opacity: isApproved ? 0.8 : 0.4,
            }}
          />
          {/* Right edge accent */}
          <div
            className="absolute right-0 top-0 bottom-0 w-px"
            style={{
              background: "var(--danger)",
              opacity: isApproved ? 0.8 : 0.4,
            }}
          />
        </div>
      );
    });

  return (
    <div
      className="flex flex-col bg-surface border-t border-border"
      style={{ height: 210 }}
    >
      {/* ── Timecode ruler ───────────────────────────────── */}
      <div className="flex items-stretch h-5 shrink-0 border-b border-border relative">
        <div className="shrink-0 w-14 border-r border-border" />
        <div
          className="flex-1 relative cursor-pointer"
          onClick={handleTimelineClick}
        >
          {rulerTicks.map((tick) => (
            <span
              key={tick.time}
              className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] text-fg-muted select-none"
              style={{ left: `${tick.percent}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Cut marker lane ──────────────────────────────── */}
      {steps.length > 0 && (
        <div
          className="flex items-stretch shrink-0 border-b border-border"
          style={{ height: 22 }}
        >
          <div className="shrink-0 flex items-center justify-center w-14 border-r border-border">
            <span className="font-mono text-[9px] text-fg-muted">Cuts</span>
          </div>
          <div
            className="flex-1 min-w-0 relative cursor-pointer"
            data-timeline-track
            onClick={handleTimelineClick}
          >
            {steps.map((step) => {
              if (duration <= 0) return null;
              const left = (step.startTime / duration) * 100;
              const width = ((step.endTime - step.startTime) / duration) * 100;
              const dur = (step.endTime - step.startTime).toFixed(1);
              const isRejected = step.status === "rejected";
              const isApproved = step.status === "approved";

              return (
                <div
                  key={`marker-${step.id}`}
                  className="absolute top-1 bottom-1 z-10 rounded-sm flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.3)}%`,
                    background: isRejected
                      ? "#27272a"
                      : isApproved
                        ? "var(--danger)"
                        : "#e5484d33",
                    border: `1px solid ${isRejected ? "#3f3f46" : isApproved ? "var(--danger)" : "#e5484d66"}`,
                  }}
                  onClick={(e) => handleSegmentClick(e, step)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const reasonLabel =
                      step.reason || step.type.replace(/_/g, " ");
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 6,
                      text: `✂ Cut ${dur}s · ${reasonLabel}`,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Drag handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20"
                    onMouseDown={(e) => handleDragStart(e, step.id, "left")}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20"
                    onMouseDown={(e) => handleDragStart(e, step.id, "right")}
                  />
                  {/* Label */}
                  <span
                    className="font-mono text-[8px] leading-none truncate px-0.5 pointer-events-none select-none"
                    style={{
                      color: isRejected
                        ? "#52525b"
                        : isApproved
                          ? "#fff"
                          : "#e5484d",
                    }}
                  >
                    ✂ {dur}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Video filmstrip track ────────────────────────── */}
      <div
        className="flex items-stretch shrink-0 border-b border-border"
        style={{ height: 52 }}
      >
        <div className="shrink-0 flex items-center justify-center w-14 border-r border-border">
          <span className="font-mono text-[10px] text-fg-muted uppercase tracking-wider">
            Video
          </span>
        </div>
        <div className="flex-1 min-w-0 relative" data-timeline-track>
          <div
            ref={filmstripRef}
            className="absolute inset-0 cursor-pointer bg-elevated"
            onClick={handleTimelineClick}
          >
            <div
              ref={videoPlayheadRef}
              className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
              style={{ left: 0, background: "var(--waveform-act)" }}
            />
            {renderTrackCutRegions()}
          </div>
        </div>
      </div>

      {/* ── Audio waveform track ─────────────────────────── */}
      <div className="flex items-stretch flex-1 min-h-0">
        <div className="shrink-0 flex items-center justify-center w-14 border-r border-border">
          <span className="font-mono text-[10px] text-fg-muted uppercase tracking-wider">
            Audio
          </span>
        </div>
        <div className="flex-1 min-w-0 relative" data-timeline-track>
          <div
            className="absolute inset-0 cursor-pointer"
            style={{ background: "var(--bg-surface)" }}
            onClick={handleTimelineClick}
          >
            <div ref={waveformRef} className="absolute inset-0" />
            <div
              ref={audioPlayheadRef}
              className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
              style={{ left: 0, background: "var(--waveform-act)" }}
            />
            {renderTrackCutRegions()}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded bg-elevated border border-border font-mono text-[10px] text-fg-secondary pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
