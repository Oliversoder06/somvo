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

export function StepCard({ step, index }: { step: EditStep; index: number }) {
  const approveStep = useEditorStore((s) => s.approveStep);
  const rejectStep = useEditorStore((s) => s.rejectStep);

  const isApproved = step.status === "approved";
  const isRejected = step.status === "rejected";
  const timeDiff = (step.endTime - step.startTime).toFixed(1);

  return (
    <div
      className={`
        border-l-[3px] rounded-r-md px-3 py-2.5 transition-all
        ${isApproved ? "border-l-success bg-(--success)/3" : ""}
        ${isRejected ? "border-l-danger opacity-40" : ""}
        ${!isApproved && !isRejected ? "border-l-border" : ""}
      `}
    >
      {/* Top row: index, type, timestamp */}
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[11px] text-fg-muted w-5 shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="font-display text-[12px] font-semibold tracking-[0.06em] text-fg">
          {TYPE_LABELS[step.type] ?? step.type.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] text-fg-muted ml-auto tabular-nums">
          {formatTimestamp(step.startTime)} – {formatTimestamp(step.endTime)}
        </span>
      </div>

      {/* Reason */}
      <p className="text-[12px] text-fg-secondary leading-[1.6] mb-2.5 pl-7">
        {step.reason}
        {step.confidence != null && (
          <span className="ml-1.5 text-fg-muted font-mono text-[10px]">
            score {step.confidence}
          </span>
        )}
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1.5 pl-7">
        <button
          onClick={() => rejectStep(step.id)}
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-display font-medium
            rounded-md border transition-colors
            ${
              isRejected
                ? "border-danger/50 text-danger bg-(--danger)/8"
                : "border-border text-fg-muted hover:text-fg-secondary hover:border-fg-muted"
            }
          `}
        >
          <X size={11} strokeWidth={1.5} />
          Reject
        </button>
        <button
          onClick={() => approveStep(step.id)}
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-display font-medium
            rounded-md border transition-colors
            ${
              isApproved
                ? "border-success/50 text-success bg-(--success)/8"
                : "border-border text-fg-muted hover:text-fg-secondary hover:border-fg-muted"
            }
          `}
        >
          <Check size={11} strokeWidth={1.5} />
          Keep
        </button>
      </div>
    </div>
  );
}
