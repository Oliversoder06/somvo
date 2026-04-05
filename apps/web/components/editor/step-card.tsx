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
  shorten: "SHORTEN",
  split: "SPLIT",
  trim: "TRIM",
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

  return (
    <div
      onClick={() => onSeek?.(Math.max(0, step.startTime - 0.5))}
      style={{
        background: isApproved
          ? "rgba(62,207,142,.04)"
          : isRejected
            ? "rgba(229,72,77,.03)"
            : "rgba(255,255,255,.02)",
        borderRadius: 12,
        padding: "10px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        opacity: isRejected ? 0.3 : 1,
        transition: "all 150ms ease",
        border: `1px solid ${
          isApproved
            ? "rgba(62,207,142,.12)"
            : isRejected
              ? "rgba(229,72,77,.08)"
              : "var(--panel-border)"
        }`,
      }}
    >
      {/* Status indicator */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isApproved) rejectStep(step.id);
          else approveStep(step.id);
        }}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `1.5px solid ${isApproved ? "var(--success)" : isRejected ? "var(--danger)" : "rgba(255,255,255,.12)"}`,
          background: isApproved ? "var(--success)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
          cursor: "pointer",
          transition: "all 120ms ease",
        }}
      >
        {isApproved && (
          <Check
            size={8}
            strokeWidth={2.5}
            style={{ color: "var(--bg-base)" }}
          />
        )}
        {isRejected && (
          <X size={8} strokeWidth={2.5} style={{ color: "var(--danger)" }} />
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {TYPE_LABELS[step.type] ?? step.type.toUpperCase()}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-muted)",
            }}
          >
            {dur}s
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          {formatTimestamp(step.startTime)} &ndash;{" "}
          {formatTimestamp(step.endTime)}
        </div>
        {step.reason && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.45,
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {step.reason}
          </div>
        )}
      </div>
    </div>
  );
}
