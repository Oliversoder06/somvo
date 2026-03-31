export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  score?: number;
};

export type CaptionChunk = {
  id: number;
  words: TranscriptWord[];
  text: string;
  start: number;
  end: number;
};

export type CaptionPreset =
  | "classic"
  | "bold"
  | "karaoke"
  | "kinetic"
  | "minimal";

export type CaptionBackground = "none" | "box" | "blur";
export type CaptionPosition = "top" | "center" | "bottom";
export type CaptionAnimation =
  | "none"
  | "fade"
  | "pop"
  | "slide"
  | "bounce"
  | "karaoke";

export type CaptionStyle = {
  preset: CaptionPreset;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  highlightColor: string;
  background: CaptionBackground;
  backgroundColor: string;
  position: CaptionPosition;
  animation: CaptionAnimation;
  maxWords: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: "classic",
  fontFamily: "Inter",
  fontSize: 32,
  fontWeight: 700,
  color: "#FFFFFF",
  highlightColor: "#FF6A52",
  background: "box",
  backgroundColor: "rgba(0,0,0,0.6)",
  position: "bottom",
  animation: "none",
  maxWords: 6,
};

export const CAPTION_PRESETS: Record<CaptionPreset, CaptionStyle> = {
  classic: { ...DEFAULT_CAPTION_STYLE },
  bold: {
    preset: "bold",
    fontFamily: "Inter",
    fontSize: 40,
    fontWeight: 900,
    color: "#FFFFFF",
    highlightColor: "#FF6A52",
    background: "none",
    backgroundColor: "transparent",
    position: "bottom",
    animation: "pop",
    maxWords: 5,
  },
  karaoke: {
    preset: "karaoke",
    fontFamily: "Inter",
    fontSize: 36,
    fontWeight: 800,
    color: "rgba(255,255,255,0.4)",
    highlightColor: "#FFFFFF",
    background: "none",
    backgroundColor: "transparent",
    position: "center",
    animation: "karaoke",
    maxWords: 6,
  },
  kinetic: {
    preset: "kinetic",
    fontFamily: "Inter",
    fontSize: 44,
    fontWeight: 900,
    color: "#FFFFFF",
    highlightColor: "#FF6A52",
    background: "none",
    backgroundColor: "transparent",
    position: "center",
    animation: "bounce",
    maxWords: 4,
  },
  minimal: {
    preset: "minimal",
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: 500,
    color: "rgba(255,255,255,0.9)",
    highlightColor: "#FF6A52",
    background: "none",
    backgroundColor: "transparent",
    position: "bottom",
    animation: "fade",
    maxWords: 8,
  },
};
