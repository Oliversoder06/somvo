"use client";

import { useMemo } from "react";
import {
  motion,
  AnimatePresence,
  type TargetAndTransition,
} from "framer-motion";
import { useEditorStore } from "@/lib/store/editor";
import { useCaptionStore } from "@/lib/store/captions";
import { getActiveChunk } from "@/lib/captions/chunk";
import type {
  CaptionChunk,
  CaptionStyle,
  TranscriptWord,
} from "@/lib/captions/types";

/* ------------------------------------------------------------------ */
/*  Position mapping                                                   */
/* ------------------------------------------------------------------ */
const POSITION_STYLES: Record<string, React.CSSProperties> = {
  top: { top: "8%", left: "50%", transform: "translateX(-50%)" },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  bottom: { bottom: "10%", left: "50%", transform: "translateX(-50%)" },
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
type Variant = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
};

const VARIANTS: Record<string, Variant> = {
  none: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  pop: {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  },
  bounce: {
    initial: { opacity: 0, scale: 0.4, y: 30 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", stiffness: 400, damping: 12 },
    },
    exit: { opacity: 0, scale: 0.8, y: -10 },
  },
  karaoke: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
};

/* ------------------------------------------------------------------ */
/*  Word renderer (handles karaoke highlight)                          */
/* ------------------------------------------------------------------ */
function CaptionWord({
  word,
  style,
  currentTime,
}: {
  word: TranscriptWord;
  style: CaptionStyle;
  currentTime: number;
}) {
  const isKaraoke = style.animation === "karaoke";
  const isActive = currentTime >= word.start;

  const color = isKaraoke
    ? isActive
      ? style.highlightColor
      : style.color
    : style.color;

  const textShadow =
    style.background === "none"
      ? "0 1px 4px rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.4)"
      : "none";

  return (
    <span
      style={{
        color,
        textShadow,
        transition: isKaraoke ? "color 80ms ease" : undefined,
        display: "inline-block",
      }}
    >
      {word.word}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Chunk renderer                                                     */
/* ------------------------------------------------------------------ */
function CaptionLine({
  chunk,
  style,
  currentTime,
}: {
  chunk: CaptionChunk;
  style: CaptionStyle;
  currentTime: number;
}) {
  const variant = VARIANTS[style.animation] ?? VARIANTS.none;

  const bgStyles: React.CSSProperties =
    style.background === "box"
      ? {
          background: style.backgroundColor,
          borderRadius: 6,
          padding: "6px 14px",
        }
      : style.background === "blur"
        ? {
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 6,
            padding: "6px 14px",
          }
        : { padding: "6px 14px" };

  return (
    <motion.div
      key={chunk.id}
      initial={variant.initial}
      animate={variant.animate}
      exit={variant.exit}
      transition={{ duration: 0.2 }}
      style={{
        ...bgStyles,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: 1.3,
        textAlign: "center",
        maxWidth: "80%",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {chunk.words.map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <CaptionWord word={w} style={style} currentTime={currentTime} />
        </span>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main overlay                                                       */
/* ------------------------------------------------------------------ */
export function CaptionOverlay() {
  const currentTime = useEditorStore((s) => s.currentTime);
  const enabled = useCaptionStore((s) => s.enabled);
  const chunks = useCaptionStore((s) => s.chunks);
  const style = useCaptionStore((s) => s.style);

  const activeChunk = useMemo(
    () => (enabled ? getActiveChunk(chunks, currentTime) : null),
    [enabled, chunks, currentTime],
  );

  if (!enabled || chunks.length === 0) return null;

  const posStyle = POSITION_STYLES[style.position] ?? POSITION_STYLES.bottom;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          ...posStyle,
          display: "flex",
          justifyContent: "center",
          zIndex: 15,
        }}
      >
        <AnimatePresence mode="wait">
          {activeChunk && (
            <CaptionLine
              key={activeChunk.id}
              chunk={activeChunk}
              style={style}
              currentTime={currentTime}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
