"use client";

import { Check, X } from "lucide-react";
import type { EditStep } from "@/lib/store/editor";
import { useEditorStore } from "@/lib/store/editor";

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

const TYPE_LABELS: Record<string, string> = {
  cut_silence: "CUT SILENCE",
  cut_filler: "CUT FILLER",
  caption: "CAPTION",
};

export function StepCard({
  step,
  onSeek,
}: {
  step: EditStep;
  onSeek?: (time: number) => void;
}) {
  const approveStep = useEditorStore((s) => s.approveStep);
  const rejectStep = useEditorStore((s) => s.rejectStep);

  const isApproved = step.status === "approved";
  const isRejected = step.status === "rejected";
  const dur = (step.endTime - step.startTime).toFixed(1);

  const borderColor = isApproved
    ? "var(--success)"
    : isRejected
      ? "var(--danger)"
      : "var(--bg-border)";

  return (
    <div
      onClick={() => onSeek?.(Math.max(0, step.startTime - 0.5))}
      style={{
        background: "var(--bg-elevated)",
        borderRadius: 7,
        padding: "9px 10px",
        borderLeft: `2px solid ${borderColor}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        opacity: isRejected ? 0.35 : 1,
        transition: "all 150ms ease",
        border: `1px solid ${isApproved ? "rgba(62,207,142,.15)" : isRejected ? "rgba(229,72,77,.1)" : "var(--bg-border)"}`,
        borderLeftWidth: 2,
        borderLeftColor: borderColor,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isApproved) rejectStep(step.id);
          else approveStep(step.id);
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: `1px solid ${isApproved ? "var(--success)" : isRejected ? "var(--danger)" : "var(--bg-border)"}`,
          background: isApproved
            ? "var(--success)"
            : isRejected
              ? "transparent"
              : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
          cursor: "pointer",
        }}
      >
        {isApproved && (
          <Check
            size={10}
            strokeWidth={2}
            style={{ color: "var(--bg-base)" }}
          />
        )}
        {isRejected && (
          <X size={10} strokeWidth={2} style={{ color: "var(--danger)" }} />
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-primary)",
          }}
        >
          {TYPE_LABELS[step.type] ?? step.type.toUpperCase()}
        </span>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {formatTimestamp(step.startTime)} &ndash;{" "}
          {formatTimestamp(step.endTime)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-muted)",
          }}
        >
          {dur}s
        </div>
      </div>
    </div>
  );
}
