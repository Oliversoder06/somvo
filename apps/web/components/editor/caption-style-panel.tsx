"use client";

import { useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Type, Sparkles, Eye, EyeOff } from "lucide-react";
import { useCaptionStore } from "@/lib/store/captions";
import { useEditorStore } from "@/lib/store/editor";
import { createClient } from "@/lib/supabase/client";
import {
  type CaptionPreset,
  type CaptionPosition,
  type CaptionAnimation,
  type CaptionBackground,
} from "@/lib/captions/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PRESET_LIST: { id: CaptionPreset; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "White text, dark background" },
  { id: "bold", label: "Bold", desc: "Large pop-in text" },
  { id: "karaoke", label: "Karaoke", desc: "Word-by-word highlight" },
  { id: "kinetic", label: "Kinetic", desc: "Bouncing centered text" },
  { id: "minimal", label: "Minimal", desc: "Small subtle captions" },
];

const POSITION_OPTIONS: { id: CaptionPosition; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];

const ANIMATION_OPTIONS: { id: CaptionAnimation; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "pop", label: "Pop" },
  { id: "slide", label: "Slide" },
  { id: "bounce", label: "Bounce" },
  { id: "karaoke", label: "Karaoke" },
];

const BG_OPTIONS: { id: CaptionBackground; label: string }[] = [
  { id: "none", label: "None" },
  { id: "box", label: "Box" },
  { id: "blur", label: "Blur" },
];

/* ------------------------------------------------------------------ */
/*  Small reusable UI pieces                                           */
/* ------------------------------------------------------------------ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </span>
  );
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex items-center gap-1"
      style={{
        background: "var(--bg-elevated)",
        borderRadius: 7,
        padding: 2,
        border: "1px solid var(--bg-border)",
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              padding: "4px 8px",
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              background: active ? "rgba(255,106,82,.15)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              transition: "all 120ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorSwatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (c: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Convert rgba to hex for the color picker (best-effort)
  const hexValue = value.startsWith("#") ? value : "#ffffff";
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: "1px solid var(--bg-border)",
          background: value,
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <input
        ref={inputRef}
        type="color"
        value={hexValue}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */
export function CaptionStylePanel() {
  const panelOpen = useCaptionStore((s) => s.panelOpen);
  const togglePanel = useCaptionStore((s) => s.togglePanel);
  const enabled = useCaptionStore((s) => s.enabled);
  const setEnabled = useCaptionStore((s) => s.setEnabled);
  const style = useCaptionStore((s) => s.style);
  const setStyle = useCaptionStore((s) => s.setStyle);
  const applyPreset = useCaptionStore((s) => s.applyPreset);
  const words = useCaptionStore((s) => s.words);
  const projectId = useEditorStore((s) => s.projectId);
  const supabase = createClient();

  // Debounced save to DB
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStyleToDb = useCallback(
    (updated: typeof style) => {
      if (!projectId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await supabase.from("caption_styles").upsert(
          {
            project_id: projectId,
            preset: updated.preset,
            font_family: updated.fontFamily,
            font_size: updated.fontSize,
            font_weight: updated.fontWeight,
            color: updated.color,
            highlight_color: updated.highlightColor,
            background: updated.background,
            background_color: updated.backgroundColor,
            position: updated.position,
            animation: updated.animation,
            max_words: updated.maxWords,
          },
          { onConflict: "project_id" },
        );
      }, 600);
    },
    [projectId, supabase],
  );

  // Persist after every style change
  useEffect(() => {
    if (words.length > 0) saveStyleToDb(style);
  }, [style, words.length, saveStyleToDb]);

  const hasWords = words.length > 0;

  if (!panelOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 260,
        maxHeight: "calc(100% - 16px)",
        background: "var(--bg-surface)",
        border: "1px solid var(--bg-border)",
        borderRadius: 12,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        boxShadow:
          "0 8px 32px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--bg-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Type
            size={13}
            strokeWidth={1.5}
            style={{ color: "var(--accent)" }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Captions
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEnabled(!enabled)}
            title={enabled ? "Hide captions" : "Show captions"}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: enabled ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {enabled ? (
              <Eye size={13} strokeWidth={1.5} />
            ) : (
              <EyeOff size={13} strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={togglePanel}
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
            }}
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {!hasWords ? (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            No transcript available yet.
            <br />
            Run an analysis with captions first.
          </div>
        ) : (
          <>
            {/* Presets */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Preset</SectionLabel>
              <div className="flex flex-col gap-1">
                {PRESET_LIST.map((p) => {
                  const active = style.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 8px",
                        borderRadius: 6,
                        border: active
                          ? "1px solid rgba(255,106,82,.3)"
                          : "1px solid var(--bg-border)",
                        background: active
                          ? "rgba(255,106,82,.08)"
                          : "var(--bg-elevated)",
                        cursor: "pointer",
                        transition: "all 120ms ease",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      <Sparkles
                        size={11}
                        strokeWidth={1.5}
                        style={{
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 11,
                            fontWeight: 600,
                            color: active
                              ? "var(--accent)"
                              : "var(--text-primary)",
                          }}
                        >
                          {p.label}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          {p.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Position</SectionLabel>
              <PillGroup
                options={POSITION_OPTIONS}
                value={style.position}
                onChange={(v) => setStyle({ position: v })}
              />
            </div>

            {/* Animation */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Animation</SectionLabel>
              <PillGroup
                options={ANIMATION_OPTIONS}
                value={style.animation}
                onChange={(v) => setStyle({ animation: v })}
              />
            </div>

            {/* Background */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Background</SectionLabel>
              <PillGroup
                options={BG_OPTIONS}
                value={style.background}
                onChange={(v) => setStyle({ background: v })}
              />
            </div>

            {/* Colors */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Colors</SectionLabel>
              <div className="flex items-center gap-4">
                <ColorSwatch
                  value={style.color}
                  onChange={(c) => setStyle({ color: c })}
                  label="Text"
                />
                <ColorSwatch
                  value={style.highlightColor}
                  onChange={(c) => setStyle({ highlightColor: c })}
                  label="Highlight"
                />
              </div>
            </div>

            {/* Font size slider */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Font size — {style.fontSize}px</SectionLabel>
              <input
                type="range"
                min={16}
                max={64}
                step={2}
                value={style.fontSize}
                onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
                style={{
                  width: "100%",
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Words per line */}
            <div className="flex flex-col gap-2">
              <SectionLabel>Words per line — {style.maxWords}</SectionLabel>
              <input
                type="range"
                min={3}
                max={12}
                step={1}
                value={style.maxWords}
                onChange={(e) => setStyle({ maxWords: Number(e.target.value) })}
                style={{
                  width: "100%",
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
