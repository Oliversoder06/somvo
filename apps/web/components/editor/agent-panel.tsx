"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, XCircle, Loader2, Download } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { createClient } from "@/lib/supabase/client";
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
  const agentStatus = useEditorStore((s) => s.agentStatus);
  const agentMessages = useEditorStore((s) => s.agentMessages);
  const steps = useEditorStore((s) => s.steps);
  const approveAll = useEditorStore((s) => s.approveAll);
  const rejectAll = useEditorStore((s) => s.rejectAll);
  const projectId = useEditorStore((s) => s.projectId);
  const setStatus = useEditorStore((s) => s.setStatus);
  const duration = useEditorStore((s) => s.duration);
  const status = useEditorStore((s) => s.status);

  const [isConfirming, setIsConfirming] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  const hasApproved = steps.some((s) => s.status === "approved");

  // Computed values
  const totalRemoved = useMemo(
    () =>
      steps
        .filter((s) => s.status === "approved")
        .reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
    [steps],
  );

  const finalDuration = duration - totalRemoved;

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function handleConfirm() {
    const approvedSteps = steps.filter((s) => s.status === "approved");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    setIsConfirming(true);
    try {
      const res = await fetch(`${apiUrl}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          approved_steps: approvedSteps.map((s) => ({
            id: s.id,
            type: s.type,
            reason: s.reason,
            start_time: s.startTime,
            end_time: s.endTime,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus("done");
        setProcessedUrl(data.processed_url ?? null);
      }
    } catch {
      // Network error
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleDownload() {
    if (!processedUrl) return;
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("processed")
      .createSignedUrl(processedUrl, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  const isStreaming = agentStatus !== null;
  const hasMessages = agentMessages.length > 0;
  const hasSteps = steps.length > 0;
  const showEmptyState = !isStreaming && !hasMessages && !hasSteps;

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border">
      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {/* Empty state */}
        {showEmptyState && (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-[13px] text-fg-muted text-center leading-[1.6] max-w-65">
              Ready. Describe what you want to do with this video.
            </p>
          </div>
        )}

        {/* Streaming status messages */}
        {hasMessages && !hasSteps && (
          <div className="flex flex-col gap-1.5">
            <AnimatePresence>
              {agentMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  {isStreaming && i === agentMessages.length - 1 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 shrink-0" />
                  )}
                  <span className="font-mono text-[12px] text-fg-secondary">
                    {msg}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Steps list */}
        {hasSteps && (
          <>
            {/* Summary bar */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-mono text-[12px] text-fg-secondary">
                {steps.length} cuts · {totalRemoved.toFixed(1)}s removed ·
                Final: {formatDuration(finalDuration)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={rejectAll}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-medium rounded border border-border text-fg-muted hover:text-danger hover:border-danger/30 transition-colors"
                >
                  <XCircle size={10} strokeWidth={1.5} />
                  All
                </button>
                <button
                  onClick={approveAll}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-medium rounded border border-border text-fg-muted hover:text-success hover:border-success/30 transition-colors"
                >
                  <CheckCheck size={10} strokeWidth={1.5} />
                  All
                </button>
              </div>
            </div>

            {/* Streaming messages above steps */}
            {hasMessages && (
              <div className="flex flex-col gap-1 mb-3">
                {agentMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-fg-muted">
                      {msg}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-1"
            >
              <AnimatePresence>
                {steps.map((step, i) => (
                  <motion.div key={step.id} variants={itemVariants}>
                    <StepCard step={step} index={i} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* ── Footer: Confirm button ───────────────────────── */}
      {hasSteps && (
        <div className="shrink-0 px-4 py-3 border-t border-border">
          {status === "done" && processedUrl ? (
            <button
              onClick={handleDownload}
              className="w-full py-2.5 bg-fg text-[#080809] font-display text-[12px] font-semibold tracking-[0.02em] rounded-md hover:bg-accent-hover active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5"
            >
              <Download size={14} strokeWidth={1.5} />
              Download processed video
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!hasApproved || isConfirming}
              className="w-full py-2.5 bg-fg text-[#080809] font-display text-[12px] font-semibold tracking-[0.02em] rounded-md hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              {isConfirming ? (
                <>
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                  Processing…
                </>
              ) : (
                "Confirm edits"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
