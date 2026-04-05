import { useCallback } from "react";
import { useEditorStore, type EditStep } from "@/lib/store/editor";
import { useCaptionStore } from "@/lib/store/captions";
import { createClient } from "@/lib/supabase/client";
import type { TranscriptWord } from "@/lib/captions/types";

export function useAgentStream(
  projectId: string | undefined,
  stepsLoadedRef: React.MutableRefObject<boolean>,
  syncStepsToDb: (steps: EditStep[]) => Promise<void>,
  pendingStepsRef: React.MutableRefObject<EditStep[] | null>,
) {
  const addAgentMessage = useEditorStore((s) => s.addAgentMessage);
  const addStep = useEditorStore((s) => s.addStep);
  const setAgentState = useEditorStore((s) => s.setAgentState);
  const clearSteps = useEditorStore((s) => s.clearSteps);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const pipelineVersion = useEditorStore((s) => s.pipelineVersion);
  const setCaptionWords = useCaptionStore((s) => s.setWords);

  const handleSubmitPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || !projectId) return;

      setAgentState("streaming");
      clearSteps();
      stepsLoadedRef.current = false;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

      try {
        const response = await fetch(`${apiUrl}/api/analyse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            prompt,
            pipeline_version: pipelineVersion,
          }),
        });

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            processSSELines(part);
          }
        }

        if (buffer.trim()) {
          processSSELines(buffer);
        }

        if (stepsLoadedRef.current) {
          const finalSteps = useEditorStore.getState().steps;
          if (finalSteps.length > 0) {
            await syncStepsToDb(finalSteps);
            pendingStepsRef.current = null;
          }
          setPreviewMode(true);
        }
      } catch {
        setAgentState("failed");
      }

      function processSSELines(chunk: string) {
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") addAgentMessage(event.message);
            if (event.type === "info") {
              addAgentMessage(event.message);
              setAgentState("idle");
            }
            if (event.type === "cut")
              addStep({ ...event.step, status: "approved" as const });
            if (event.type === "broll")
              addStep({ ...event.step, status: "approved" as const });
            if (event.type === "caption")
              addStep({ ...event.step, status: "approved" as const });
            if (event.type === "captions_ready") {
              // Reload transcript words into caption store from DB and enable captions
              const supabase = createClient();
              supabase
                .from("transcripts")
                .select("words")
                .eq("project_id", projectId!)
                .maybeSingle()
                .then(({ data }) => {
                  if (data?.words) {
                    setCaptionWords(data.words as unknown as TranscriptWord[]);
                    useCaptionStore.getState().setEnabled(true);
                  }
                });
            }
            if (event.type === "done") {
              setAgentState("done");
              stepsLoadedRef.current = true;
            }
            if (event.type === "error") {
              addAgentMessage(`Error: ${event.message}`);
              setAgentState("failed");
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    },
    [
      projectId,
      pipelineVersion,
      setAgentState,
      clearSteps,
      addAgentMessage,
      addStep,
      setCaptionWords,
      syncStepsToDb,
      setPreviewMode,
      stepsLoadedRef,
      pendingStepsRef,
    ],
  );

  return handleSubmitPrompt;
}
