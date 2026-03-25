"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/store/editor";

export function Timeline({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const steps = useEditorStore((s) => s.steps);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const rawContainerRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rawContainerRef.current || !editContainerRef.current) return;

    let peaksInstance: unknown = null;

    async function initPeaks() {
      try {
        const player = playerRef.current;
        if (!player || !(player instanceof HTMLMediaElement)) return;

        const Peaks = (await import("peaks.js")).default;

        const audioCtx = new AudioContext();

        const instance = Peaks.init({
          zoomview: {
            container: rawContainerRef.current!,
          },
          overview: {
            container: editContainerRef.current!,
          },
          mediaElement: player,
          webAudio: {
            audioContext: audioCtx,
          },
          zoomLevels: [256, 512, 1024, 2048],
          playheadColor: "var(--waveform-act)",
          playheadTextColor: "var(--text-secondary)",
          axisGridlineColor: "var(--bg-border)",
          axisLabelColor: "var(--text-muted)",
        });

        peaksInstance = instance;
        peaksRef.current = instance;
      } catch {
        // Peaks.js may fail without a valid media source — this is expected during processing
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

  // Add segments when steps change
  useEffect(() => {
    const peaks = peaksRef.current;
    if (
      !peaks ||
      typeof peaks !== "object" ||
      !("segments" in (peaks as Record<string, unknown>))
    )
      return;

    const p = peaks as {
      segments: {
        removeAll: () => void;
        add: (seg: {
          startTime: number;
          endTime: number;
          color: string;
          labelText: string;
        }) => void;
      };
    };

    try {
      p.segments.removeAll();

      steps.forEach((step) => {
        const color =
          step.type === "caption"
            ? "rgba(245, 166, 35, 0.2)"
            : "rgba(229, 72, 77, 0.2)";

        p.segments.add({
          startTime: step.startTime,
          endTime: step.endTime,
          color,
          labelText: step.type,
        });
      });
    } catch {
      // Segments API may not be ready
    }
  }, [steps]);

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-surface border-t border-border">
      {/* Raw track */}
      <div className="flex-1 flex items-stretch min-h-0">
        <div className="w-16 shrink-0 flex items-center justify-center border-r border-border">
          <span className="font-mono text-[11px] text-fg-muted">RAW</span>
        </div>
        <div
          className="flex-1 relative"
          style={{ background: "var(--timeline-raw)" }}
        >
          <div ref={rawContainerRef} className="absolute inset-0" />
          {/* Fallback playhead if Peaks.js doesn't load */}
          <div
            className="absolute top-0 bottom-0 w-px z-10"
            style={{
              left: `${playheadPercent}%`,
              background: "var(--waveform-act)",
            }}
          />
          {/* Step segments overlay */}
          {steps.map((step) => {
            if (duration <= 0) return null;
            const left = (step.startTime / duration) * 100;
            const width = ((step.endTime - step.startTime) / duration) * 100;
            const bg =
              step.type === "caption"
                ? "var(--timeline-cap)"
                : "var(--timeline-cut)";
            return (
              <div
                key={step.id}
                className="absolute top-0 bottom-0 cursor-pointer"
                style={{ left: `${left}%`, width: `${width}%`, background: bg }}
                onClick={() => {
                  const el = playerRef.current;
                  if (el) el.currentTime = step.startTime;
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Edit track */}
      <div className="flex-1 flex items-stretch min-h-0 border-t border-border">
        <div className="w-16 shrink-0 flex items-center justify-center border-r border-border">
          <span className="font-mono text-[11px] text-fg-muted">EDIT</span>
        </div>
        <div
          className="flex-1 relative"
          style={{ background: "var(--timeline-edit)" }}
        >
          <div ref={editContainerRef} className="absolute inset-0" />
          <div
            className="absolute top-0 bottom-0 w-px z-10"
            style={{
              left: `${playheadPercent}%`,
              background: "var(--waveform-act)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
