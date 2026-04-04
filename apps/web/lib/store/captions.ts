import { create } from "zustand";
import type {
  TranscriptWord,
  CaptionChunk,
  CaptionStyle,
  CaptionPreset,
} from "@/lib/captions/types";
import { DEFAULT_CAPTION_STYLE, CAPTION_PRESETS } from "@/lib/captions/types";
import { chunkTranscript } from "@/lib/captions/chunk";

interface CaptionStore {
  /** Raw word-level transcript from DB */
  words: TranscriptWord[];
  /** Pre-computed display chunks (derived from words + style.maxWords) */
  chunks: CaptionChunk[];
  /** Whether captions are enabled/visible in the preview */
  enabled: boolean;
  /** Whether the style panel is open */
  panelOpen: boolean;
  /** Current caption style */
  style: CaptionStyle;

  // Actions
  setWords: (words: TranscriptWord[]) => void;
  setEnabled: (v: boolean) => void;
  togglePanel: () => void;
  setStyle: (partial: Partial<CaptionStyle>) => void;
  applyPreset: (preset: CaptionPreset) => void;
  reset: () => void;
}

function rechunk(words: TranscriptWord[], maxWords: number): CaptionChunk[] {
  return chunkTranscript(words, maxWords);
}

export const useCaptionStore = create<CaptionStore>((set, get) => ({
  words: [],
  chunks: [],
  enabled: false,
  panelOpen: false,
  style: { ...DEFAULT_CAPTION_STYLE },

  setWords: (words) =>
    set({
      words,
      chunks: rechunk(words, get().style.maxWords),
    }),

  setEnabled: (v) => set({ enabled: v }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  setStyle: (partial) =>
    set((s) => {
      const next = { ...s.style, ...partial };
      const needsRechunk = partial.maxWords !== undefined;
      return {
        style: next,
        chunks: needsRechunk ? rechunk(s.words, next.maxWords) : s.chunks,
      };
    }),

  applyPreset: (preset) =>
    set((s) => {
      const next = { ...CAPTION_PRESETS[preset] };
      return {
        style: next,
        chunks: rechunk(s.words, next.maxWords),
      };
    }),

  reset: () =>
    set({
      words: [],
      chunks: [],
      enabled: false,
      panelOpen: false,
      style: { ...DEFAULT_CAPTION_STYLE },
    }),
}));
