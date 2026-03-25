"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";

function formatRulerTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSegmentColor(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return "var(--danger)";
    case "rejected":
      return "#4a4846";
    default:
      return "var(--danger)";
  }
}

function getSegmentOpacity(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return 0.4;
    case "rejected":
      return 0.15;
    default:
      return 0.2;
  }
}

export function Timeline({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const steps = useEditorStore((s) => s.steps);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const updateStepBounds = useEditorStore((s) => s.updateStepBounds);
  const waveformRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<unknown>(null);

  const [dragState, setDragState] = useState<{
    stepId: string;
    edge: "left" | "right";
  } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Generate ruler ticks based on duration
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

  // Peaks.js init — single overview waveform
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!waveformRef.current) return;

    let peaksInstance: unknown = null;

    async function initPeaks() {
      try {
        const player = playerRef.current;
        if (!player || !(player instanceof HTMLMediaElement)) return;

        const Peaks = (await import("peaks.js")).default;
        const audioCtx = new AudioContext();

        const instance = Peaks.init({
          overview: { container: waveformRef.current! },
          mediaElement: player,
          webAudio: { audioContext: audioCtx },
          zoomLevels: [512, 1024, 2048],
          playheadColor: "var(--waveform-act)",
          playheadTextColor: "var(--text-secondary)",
          axisGridlineColor: "var(--bg-border)",
          axisLabelColor: "var(--text-muted)",
        });

        peaksInstance = instance;
        peaksRef.current = instance;
      } catch {
        // Expected during processing
      }
    }

    initPeaks();

    return () => {
      if (
        peaksInstance &&
        typeof peaksInstance === "object" &&
        peaksInstance !== null &&
        "destroy" in peaksInstance
      ) {
        (peaksInstance as { destroy: () => void }).destroy();
      }
    };
  }, [playerRef, duration]);

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

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

  // Segment click: seek to start - 0.5 and play context
  const handleSegmentClick = useCallback(
    (e: React.MouseEvent, step: (typeof steps)[0]) => {
      e.stopPropagation();
      const el = playerRef.current;
      if (!el) return;
      const seekTo = Math.max(0, step.startTime - 0.5);
      el.currentTime = seekTo;
      setCurrentTime(seekTo);
      el.play().catch(() => {});
      // Auto-pause after the segment context
      const endAt = step.endTime + 0.5;
      const checkPause = () => {
        if (el.currentTime >= endAt) {
          el.pause();
          el.removeEventListener("timeupdate", checkPause);
        }
      };
      el.addEventListener("timeupdate", checkPause);
    },
    [playerRef, setCurrentTime],
  );

  // Drag handle for segment left/right edges
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

  return (
    <div className="h-35 flex flex-col bg-surface border-t border-border">
      {/* ── Timecode ruler ───────────────────────────────── */}
      <div className="flex items-stretch h-5 shrink-0 border-b border-border">
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

      {/* ── Single waveform track ────────────────────────── */}
      <div className="flex-1 min-h-0 relative" data-timeline-track>
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ background: "var(--bg-surface)" }}
          onClick={handleTimelineClick}
        >
          <div ref={waveformRef} className="absolute inset-0" />

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
            style={{
              left: `${playheadPercent}%`,
              background: "var(--waveform-act)",
            }}
          />

          {/* Cut region segments */}
          {steps.map((step) => {
            if (duration <= 0) return null;
            const left = (step.startTime / duration) * 100;
            const width = ((step.endTime - step.startTime) / duration) * 100;
            const segColor = getSegmentColor(step.status);
            const segOpacity = getSegmentOpacity(step.status);
            const dur = (step.endTime - step.startTime).toFixed(1);

            return (
              <div
                key={step.id}
                className="absolute top-0 bottom-0 z-10 group"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: segColor,
                  opacity: segOpacity,
                }}
                onClick={(e) => handleSegmentClick(e, step)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    text: `${dur}s silence — click to preview`,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Left drag handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-fg/20 z-30"
                  onMouseDown={(e) => handleDragStart(e, step.id, "left")}
                />
                {/* Right drag handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-fg/20 z-30"
                  onMouseDown={(e) => handleDragStart(e, step.id, "right")}
                />
              </div>
            );
          })}
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
    </div>
  );
}
