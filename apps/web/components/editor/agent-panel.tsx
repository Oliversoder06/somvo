"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle,
  Sparkles,
  Clock,
  Scissors,
  CheckCheck,
  XCircle,
  ArrowUp,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  Lock,
} from "lucide-react";
import { useEditorStore, PIPELINE_VERSIONS } from "@/lib/store/editor";
import { StepCard } from "./step-card";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const containerVariants = {
  show: { transition: { staggerChildren: 0.04 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
};

export function AgentPanel({
  onSeek,
  prompt,
  setPrompt,
  onSubmitPrompt,
}: {
  onSeek?: (time: number) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmitPrompt: () => void;
}) {
  const agentState = useEditorStore((s) => s.agentState);
  const agentMessages = useEditorStore((s) => s.agentMessages);
  const steps = useEditorStore((s) => s.steps);
  const approveAll = useEditorStore((s) => s.approveAll);
  const rejectAll = useEditorStore((s) => s.rejectAll);
  const projectId = useEditorStore((s) => s.projectId);
  const setStatus = useEditorStore((s) => s.setStatus);
  const duration = useEditorStore((s) => s.duration);
  const agentPanelOpen = useEditorStore((s) => s.agentPanelOpen);
  const toggleAgentPanel = useEditorStore((s) => s.toggleAgentPanel);
  const pipelineVersion = useEditorStore((s) => s.pipelineVersion);
  const setPipelineVersion = useEditorStore((s) => s.setPipelineVersion);

  const [isConfirming, setIsConfirming] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedPipeline =
    PIPELINE_VERSIONS.find((p) => p.id === pipelineVersion) ??
    PIPELINE_VERSIONS[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const hasApproved = steps.some((s) => s.status === "approved");

  const totalRemoved = useMemo(
    () =>
      steps
        .filter((s) => s.status === "approved")
        .reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
    [steps],
  );

  const approvedCount = steps.filter((s) => s.status === "approved").length;
  const finalDuration = duration - totalRemoved;

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
        setStatus("done");
      }
    } catch {
      // Network error
    } finally {
      setIsConfirming(false);
    }
  }

  const isStreaming = agentState === "streaming";
  const hasSteps = steps.length > 0;
  const hasMessages = agentMessages.length > 0;
  const showEmpty = agentState === "idle" && !hasMessages && !hasSteps;

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: agentPanelOpen ? 320 : 0,
        minWidth: agentPanelOpen ? 320 : 0,
        background: "var(--bg-surface)",
        borderLeft: agentPanelOpen ? "1px solid var(--bg-border)" : "none",
        transition: "width 200ms ease, min-width 200ms ease",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--bg-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {/* Gradient accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, var(--accent-from), var(--accent-to))",
            opacity: 0.3,
          }}
        />
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {selectedPipeline.name}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              style={{
                color: "var(--text-muted)",
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms ease",
              }}
            />
          </button>

          {/* Pipeline version dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: 260,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 10,
                  padding: 6,
                  zIndex: 50,
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.04)",
                }}
              >
                {PIPELINE_VERSIONS.map((p) => {
                  const isSelected = p.id === pipelineVersion;
                  const isLocked = !p.available;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isLocked) return;
                        setPipelineVersion(p.id);
                        setDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        width: "100%",
                        padding: "10px 10px",
                        borderRadius: 7,
                        border: "none",
                        background: isSelected
                          ? "rgba(255,106,82,.08)"
                          : "transparent",
                        cursor: isLocked ? "default" : "pointer",
                        opacity: isLocked ? 0.45 : 1,
                        textAlign: "left",
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isLocked && !isSelected)
                          e.currentTarget.style.background =
                            "rgba(255,255,255,.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isLocked && !isSelected)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Radio dot */}
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          border: isSelected
                            ? "2px solid var(--accent)"
                            : "1.5px solid var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "var(--accent)",
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="flex items-center gap-1.5"
                          style={{ marginBottom: 2 }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: 12,
                              fontWeight: 600,
                              color: isSelected
                                ? "var(--accent)"
                                : "var(--text-primary)",
                            }}
                          >
                            {p.name}
                          </span>
                          {isLocked && (
                            <Lock
                              size={10}
                              strokeWidth={1.5}
                              style={{ color: "var(--text-muted)" }}
                            />
                          )}
                          {!p.available && (
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 9,
                                color: "var(--text-muted)",
                                background: "rgba(255,255,255,.06)",
                                padding: "1px 5px",
                                borderRadius: 4,
                                letterSpacing: "0.03em",
                              }}
                            >
                              {p.minPlan}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 11,
                            color: "var(--text-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          {p.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 8px var(--accent)",
              }}
            />
          )}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: isStreaming ? "var(--accent)" : "var(--success)",
            }}
          >
            {isStreaming ? "Analysing" : "Ready"}
          </span>
          <button
            onClick={toggleAgentPanel}
            title="Close Director panel"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 4,
              transition: "all 120ms ease",
            }}
          >
            <PanelRightClose size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ padding: "0 12px" }}
      >
        {/* Empty state */}
        {showEmpty && (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ padding: "0 20px" }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <Sparkles
                size={20}
                strokeWidth={1.2}
                style={{ color: "var(--accent)", opacity: 0.7 }}
              />
            </div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                textAlign: "center",
                lineHeight: 1.4,
                marginBottom: 8,
              }}
            >
              Ready to edit
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--text-secondary)",
                textAlign: "center",
                lineHeight: 1.6,
                maxWidth: 210,
              }}
            >
              Describe what you want to do, or pick a quick action below.
            </p>
          </div>
        )}

        {/* Streaming messages */}
        {hasMessages && (
          <div className="flex flex-col gap-2" style={{ paddingTop: 12 }}>
            <AnimatePresence>
              {agentMessages.map((msg, i) => {
                const isCurrent = isStreaming && i === agentMessages.length - 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2.5"
                    style={{ padding: "2px 0" }}
                  >
                    {isCurrent ? (
                      <span
                        className="animate-pulse"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          boxShadow: "0 0 6px var(--accent)",
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                    ) : (
                      <CheckCircle
                        size={12}
                        strokeWidth={1.5}
                        style={{
                          color: "var(--success)",
                          flexShrink: 0,
                          marginTop: 3,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: isCurrent
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {msg}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Summary bar + cut list */}
        {hasSteps && (
          <>
            <div
              style={{
                background: "var(--bg-elevated)",
                borderRadius: 8,
                padding: "10px 12px",
                margin: "10px 0 8px",
                border: "1px solid var(--bg-border)",
              }}
            >
              <div
                className="flex items-center gap-2 flex-wrap"
                style={{ marginBottom: 8 }}
              >
                <span
                  className="badge"
                  style={{
                    background: "rgba(255,106,82,.1)",
                    color: "var(--accent)",
                    border: "1px solid rgba(255,106,82,.15)",
                  }}
                >
                  <Clock size={9} strokeWidth={1.5} />
                  {totalRemoved.toFixed(1)}s removed
                </span>
                <span
                  className="badge"
                  style={{
                    background: "rgba(62,207,142,.1)",
                    color: "var(--success)",
                    border: "1px solid rgba(62,207,142,.15)",
                  }}
                >
                  <Scissors size={9} strokeWidth={1.5} />
                  {approvedCount} cuts
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                {formatDuration(duration)} &rarr;{" "}
                {formatDuration(finalDuration)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={approveAll}
                  className="flex items-center gap-1.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--success)",
                    background: "rgba(62,207,142,.08)",
                    border: "1px solid rgba(62,207,142,.15)",
                    borderRadius: 5,
                    padding: "4px 8px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <CheckCheck size={11} strokeWidth={1.5} />
                  Accept all
                </button>
                <button
                  onClick={rejectAll}
                  className="flex items-center gap-1.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    background: "transparent",
                    border: "1px solid var(--bg-border)",
                    borderRadius: 5,
                    padding: "4px 8px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <XCircle size={11} strokeWidth={1.5} />
                  Reject all
                </button>
              </div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col"
              style={{ gap: 4, paddingBottom: 8 }}
            >
              <AnimatePresence>
                {steps.map((step) => (
                  <motion.div key={step.id} variants={cardVariants}>
                    <StepCard step={step} onSeek={onSeek} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Confirm edits button */}
      {hasSteps && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--bg-border)",
          }}
        >
          <button
            onClick={handleConfirm}
            disabled={!hasApproved || isConfirming}
            style={{
              width: "100%",
              background: hasApproved
                ? "linear-gradient(135deg, var(--accent-from), var(--accent-to))"
                : "var(--bg-elevated)",
              color: hasApproved ? "#fff" : "var(--text-muted)",
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.02em",
              padding: "10px 0",
              borderRadius: 8,
              textAlign: "center",
              cursor: hasApproved && !isConfirming ? "pointer" : "not-allowed",
              border: hasApproved ? "none" : "1px solid var(--bg-border)",
              opacity: hasApproved ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: hasApproved ? "0 0 20px rgba(255,106,82,.2)" : "none",
              transition: "all 150ms ease",
            }}
          >
            {isConfirming ? (
              <>
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm edits"
            )}
          </button>
        </div>
      )}

      {/* ---- Prompt input area (pinned bottom, like Cardboard) ---- */}
      <div
        style={{
          padding: "10px 12px 12px",
          borderTop: "1px solid var(--bg-border)",
        }}
      >
        {/* Quick actions */}
        {showEmpty && (
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <button
              onClick={() =>
                setPrompt("Remove all silent parts from this video")
              }
              disabled={isStreaming}
              className="editor-pill"
              style={{ flex: 1 }}
            >
              <Scissors size={11} strokeWidth={1.5} />
              Silence
            </button>
            <button
              onClick={() => setPrompt("Add captions to this video")}
              disabled={isStreaming}
              className="editor-pill"
              style={{ flex: 1 }}
            >
              <MessageSquare size={11} strokeWidth={1.5} />
              Captions
            </button>
          </div>
        )}

        {/* Input + send */}
        <div className="relative">
          <input
            type="text"
            value={isStreaming ? "Analysing..." : prompt}
            onChange={(e) => !isStreaming && setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmitPrompt();
              }
            }}
            disabled={isStreaming}
            placeholder="What do you want to do?"
            className="editor-input"
            style={{
              width: "100%",
              background: "var(--bg-elevated)",
              border: "1px solid var(--bg-border)",
              borderRadius: 10,
              height: 40,
              padding: "0 40px 0 14px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: isStreaming ? "var(--text-muted)" : "var(--text-primary)",
              outline: "none",
              transition: "border-color 150ms ease, box-shadow 150ms ease",
            }}
          />
          <button
            onClick={onSubmitPrompt}
            disabled={!prompt.trim() || isStreaming}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background:
                prompt.trim() && !isStreaming ? "var(--accent)" : "transparent",
              color:
                prompt.trim() && !isStreaming ? "#fff" : "var(--text-muted)",
              cursor: prompt.trim() && !isStreaming ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms ease",
              opacity: prompt.trim() && !isStreaming ? 1 : 0.3,
            }}
          >
            <ArrowUp size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
