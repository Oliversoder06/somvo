import type { TranscriptWord, CaptionChunk } from "./types";

const SENTENCE_ENDINGS = /[.?!]$/;
const CLAUSE_BREAK = /,$/;
const MAX_DURATION = 2.5;
const MIN_WORDS_FOR_GAP_BREAK = 3;
const GAP_THRESHOLD = 0.4;

/**
 * Groups word-level timestamps into display-ready caption chunks.
 *
 * Uses a hybrid strategy:
 *  1. Time cap — no chunk longer than ~2.5s
 *  2. Word cap — controlled by `maxWords` (default 6)
 *  3. Natural breaks — split at punctuation, breathing pauses, clause boundaries
 */
export function chunkTranscript(
  words: TranscriptWord[],
  maxWords = 6,
): CaptionChunk[] {
  if (words.length === 0) return [];

  const chunks: CaptionChunk[] = [];
  let current: TranscriptWord[] = [];
  let chunkId = 0;

  function finalise() {
    if (current.length === 0) return;
    chunks.push({
      id: chunkId++,
      words: [...current],
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
    });
    current = [];
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    current.push(w);

    const duration = current[current.length - 1].end - current[0].start;
    const wordCount = current.length;
    const trimmed = w.word.trim();
    const nextWord = i + 1 < words.length ? words[i + 1] : null;
    const gapToNext = nextWord ? nextWord.start - w.end : 0;

    const isSentenceEnd = SENTENCE_ENDINGS.test(trimmed);
    const isClauseBreak = CLAUSE_BREAK.test(trimmed) && wordCount >= 4;
    const isTimeOverflow = duration >= MAX_DURATION;
    const isWordOverflow = wordCount >= maxWords;
    const isNaturalPause =
      gapToNext > GAP_THRESHOLD && wordCount >= MIN_WORDS_FOR_GAP_BREAK;

    if (
      isSentenceEnd ||
      isClauseBreak ||
      isTimeOverflow ||
      isWordOverflow ||
      isNaturalPause
    ) {
      finalise();
    }
  }

  finalise();
  return chunks;
}

/**
 * Find the active caption chunk for a given playback time.
 * Returns `null` if no chunk covers the given time.
 */
export function getActiveChunk(
  chunks: CaptionChunk[],
  time: number,
): CaptionChunk | null {
  // Binary search since chunks are sorted by start time
  let lo = 0;
  let hi = chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const c = chunks[mid];
    if (time < c.start) {
      hi = mid - 1;
    } else if (time > c.end) {
      lo = mid + 1;
    } else {
      return c;
    }
  }
  return null;
}
