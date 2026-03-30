"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowRight, Scissors, MessageSquare, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PILLS = [
  {
    icon: Scissors,
    label: "Remove silence",
    prompt: "Remove all silent parts from this video",
    active: true,
  },
  {
    icon: MessageSquare,
    label: "Add captions",
    prompt: "Add captions to this video",
    active: true,
  },
  {
    icon: Zap,
    label: "Quick export",
    prompt: "Clean up this video and export",
    active: true,
    autoApprove: true,
  },
];

export function HeroPrompt({
  heading,
  onSubmit,
  onFileDrop,
  showModeToggle = true,
}: {
  heading: string;
  onSubmit: (prompt: string, autoApprove: boolean) => void;
  onFileDrop?: (file: File) => void;
  showModeToggle?: boolean;
}) {
  const [value, setValue] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    onSubmit(value.trim(), autoApprove);
    setValue("");
  }, [value, autoApprove, onSubmit]);

  const handlePillClick = (pill: (typeof PILLS)[number]) => {
    setValue(pill.prompt);
    if (pill.autoApprove) setAutoApprove(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && onFileDrop) onFileDrop(file);
  };

  return (
    <div style={{ marginBottom: "var(--space-10)" }}>
      {heading && (
        <h2
          className="font-display text-[24px] font-bold"
          style={{
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-4)",
          }}
        >
          {heading}
        </h2>
      )}

      {/* Quick action pills */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ marginBottom: "var(--space-4)" }}
      >
        {PILLS.map((pill) => (
          <button
            key={pill.label}
            onClick={() => handlePillClick(pill)}
            className="inline-flex items-center gap-1.5 font-display text-[12px] transition-colors"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--bg-border)",
              borderRadius: "20px",
              padding: "5px 12px",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--bg-border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <pill.icon size={12} strokeWidth={1.5} />
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="flex items-center gap-2 rounded-md transition-colors"
          style={{
            background: "var(--bg-elevated)",
            border: `1px solid ${isDragOver ? "var(--accent)" : "var(--bg-border)"}`,
            borderRadius: "6px",
            padding: "10px 14px",
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Drop a video or describe what you want..."
            className="flex-1 bg-transparent font-body text-[14px] outline-none placeholder:text-[var(--text-muted)]"
            style={{
              color: "var(--text-primary)",
            }}
          />
          <AnimatePresence>
            {value.trim() && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={handleSubmit}
                className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-colors"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }}
              >
                <ArrowRight size={16} strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Hidden file input for drag-drop */}
        {onFileDrop && (
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onFileDrop) onFileDrop(file);
            }}
          />
        )}
      </div>

      {/* Mode toggle */}
      {showModeToggle && (
        <div
          className="flex items-center gap-5"
          style={{ marginTop: "var(--space-3)" }}
        >
          <label
            className="flex items-center gap-2 cursor-pointer font-mono text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="radio"
              name="mode"
              checked={!autoApprove}
              onChange={() => setAutoApprove(false)}
              className="accent-current"
            />
            Review edits first
          </label>
          <label
            className="flex items-center gap-2 cursor-pointer font-mono text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="radio"
              name="mode"
              checked={autoApprove}
              onChange={() => setAutoApprove(true)}
              className="accent-current"
            />
            Quick export — auto-approve everything
          </label>
        </div>
      )}
    </div>
  );
}
