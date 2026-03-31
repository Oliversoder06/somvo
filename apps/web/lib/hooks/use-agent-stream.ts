import { useCallback } from "react";
import { useEditorStore, type EditStep } from "@/lib/store/editor";

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
            if (event.type === "cut")
              addStep({ ...event.step, status: "approved" as const });
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
      syncStepsToDb,
      setPreviewMode,
      stepsLoadedRef,
      pendingStepsRef,
    ],
  );

  return handleSubmitPrompt;
}
