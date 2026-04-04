import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCaptionStore } from "@/lib/store/captions";
import { useEditorStore } from "@/lib/store/editor";
import type { TranscriptWord } from "@/lib/captions/types";

/**
 * Fetches the transcript for a project and loads it into the caption store.
 * Also loads any saved caption style from the DB.
 */
export function useTranscript(projectId: string | undefined) {
  const setWords = useCaptionStore((s) => s.setWords);
  const setEnabled = useCaptionStore((s) => s.setEnabled);
  const setStyle = useCaptionStore((s) => s.setStyle);
  const reset = useCaptionStore((s) => s.reset);
  const supabase = createClient();
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (loadedForRef.current === projectId) return;

    let cancelled = false;

    async function load() {
      // Fetch transcript words
      const { data: transcript } = await supabase
        .from("transcripts")
        .select("words")
        .eq("project_id", projectId!)
        .maybeSingle();

      if (cancelled) return;

      if (transcript?.words) {
        const words = transcript.words as unknown as TranscriptWord[];
        setWords(words);

        // Only enable captions if there are caption-type steps in the editor store
        const steps = useEditorStore.getState().steps;
        const hasCaptionSteps = steps.some((s) => s.type === "caption");
        if (hasCaptionSteps) {
          setEnabled(true);
        }
      }

      // Fetch saved caption style
      const { data: savedStyle } = await supabase
        .from("caption_styles")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();

      if (cancelled || !savedStyle) return;

      setStyle({
        preset: savedStyle.preset as never,
        fontFamily: savedStyle.font_family,
        fontSize: savedStyle.font_size,
        fontWeight: savedStyle.font_weight,
        color: savedStyle.color,
        highlightColor: savedStyle.highlight_color,
        background: savedStyle.background as never,
        backgroundColor: savedStyle.background_color,
        position: savedStyle.position as never,
        animation: savedStyle.animation as never,
        maxWords: savedStyle.max_words,
      });

      loadedForRef.current = projectId!;
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId, supabase, setWords, setStyle]);

  // Reset on project change
  useEffect(() => {
    return () => {
      reset();
      loadedForRef.current = null;
    };
  }, [projectId, reset]);
}
