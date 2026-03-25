"use client";

import { motion } from "framer-motion";
import { CheckCheck, XCircle, Loader2, Sparkles } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { StepCard } from "./step-card";

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function AgentPanel() {
  const status = useEditorStore((s) => s.status);
  const steps = useEditorStore((s) => s.steps);
  const approvedStepIds = useEditorStore((s) => s.approvedStepIds);
  const rejectedStepIds = useEditorStore((s) => s.rejectedStepIds);
  const approveAll = useEditorStore((s) => s.approveAll);
  const rejectAll = useEditorStore((s) => s.rejectAll);
  const focusedStepIndex = useEditorStore((s) => s.focusedStepIndex);
  const setFocusedStepIndex = useEditorStore((s) => s.setFocusedStepIndex);
  const projectId = useEditorStore((s) => s.projectId);

  const isProcessing = status === "uploading" || status === "processing";
  const hasApproved = approvedStepIds.size > 0;

  const estimatedTimeSaved = steps.reduce(
    (sum, step) => sum + (step.endTime - step.startTime),
    0,
  );

  const approvedCount = approvedStepIds.size;
  const rejectedCount = rejectedStepIds.size;

  async function handleConfirm() {
    const approvedSteps = steps.filter((s) => approvedStepIds.has(s.id));
    try {
      await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, approvedSteps }),
      });
    } catch {
      // Backend endpoint not yet implemented
    }
  }

  // Processing state — pulsing "Analysing"
  if (isProcessing) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Sparkles
              size={20}
              strokeWidth={1.5}
              className="text-fg-muted animate-pulse"
            />
            <p className="font-mono text-[12px] text-fg-muted animate-pulse">
              Analysing your video…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (status === "failed") {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[12px] text-danger">Processing failed</p>
        </div>
      </div>
    );
  }

  // Ready / Done — show steps
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-secondary">
            Agent Reasoning
          </h2>
        </div>

        {steps.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-fg-secondary">
                {steps.length} edits
              </span>
              <span className="font-mono text-[11px] text-fg-muted">
                ~{estimatedTimeSaved.toFixed(1)}s saved
              </span>
              {approvedCount > 0 && (
                <span className="font-mono text-[10px] text-success">
                  {approvedCount} approved
                </span>
              )}
              {rejectedCount > 0 && (
                <span className="font-mono text-[10px] text-danger">
                  {rejectedCount} rejected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={approveAll}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-medium uppercase tracking-[0.04em] rounded border border-border text-fg-muted hover:text-success hover:border-success/30 transition-colors"
              >
                <CheckCheck size={10} strokeWidth={1.5} />
                All
              </button>
              <button
                onClick={rejectAll}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-medium uppercase tracking-[0.04em] rounded border border-border text-fg-muted hover:text-danger hover:border-danger/30 transition-colors"
              >
                <XCircle size={10} strokeWidth={1.5} />
                All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2
              size={18}
              strokeWidth={1.5}
              className="text-fg-muted animate-spin mb-2"
            />
            <p className="font-mono text-[11px] text-fg-muted">
              Waiting for edit steps…
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-1"
          >
            {steps.map((step, i) => (
              <motion.div key={step.id} variants={itemVariants}>
                <StepCard
                  step={step}
                  index={i}
                  isFocused={focusedStepIndex === i}
                  onFocus={() => setFocusedStepIndex(i)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Footer — Confirm button */}
      {steps.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border shrink-0">
          <button
            onClick={handleConfirm}
            disabled={!hasApproved}
            className="w-full py-2 bg-accent text-[#0a0a0b] font-display text-[12px] font-semibold uppercase tracking-[0.02em] rounded-md hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm {approvedCount > 0 ? `${approvedCount} ` : ""}edits
          </button>
        </div>
      )}
    </div>
  );
}
