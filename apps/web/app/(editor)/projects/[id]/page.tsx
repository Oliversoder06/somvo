"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useHotkeys } from "react-hotkeys-hook";
import { Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore, type EditStep } from "@/lib/store/editor";
import { VideoPreview } from "@/components/editor/video-preview";
import { AgentPanel } from "@/components/editor/agent-panel";
import { Timeline } from "@/components/editor/timeline";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const setProjectId = useEditorStore((s) => s.setProjectId);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const setStatus = useEditorStore((s) => s.setStatus);
  const setVideoUrl = useEditorStore((s) => s.setVideoUrl);
  const setSteps = useEditorStore((s) => s.setSteps);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addStep = useEditorStore((s) => s.addStep);
  const setAgentStatus = useEditorStore((s) => s.setAgentStatus);
  const clearAgent = useEditorStore((s) => s.clearAgent);

  const [prompt, setPrompt] = useState("");

  // Fetch project data
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Sync project data into Zustand store — set to 'ready' (no auto-processing)
  useEffect(() => {
    if (!project) return;
    setProjectId(project.id);
    setProjectName(project.filename);
    // If project was left in processing state, reset to ready
    const effectiveStatus =
      project.status === "processing" ? "ready" : project.status;
    setStatus(
      effectiveStatus as
        | "ready"
        | "done"
        | "failed"
        | "uploading"
        | "processing",
    );
  }, [project, setProjectId, setProjectName, setStatus]);

  // Generate signed URL when project is available
  useEffect(() => {
    if (!project?.raw_url) return;

    async function getSignedUrl() {
      const { data, error } = await supabase.storage
        .from("raw")
        .createSignedUrl(project!.raw_url!, 3600);
      if (error) {
        console.error(
          "[Somvo] Failed to create signed URL:",
          error.message,
          "path:",
          project!.raw_url,
        );
        return;
      }
      if (data?.signedUrl) {
        setVideoUrl(data.signedUrl);
      }
    }

    getSignedUrl();
  }, [project?.raw_url, supabase.storage, setVideoUrl, project]);

  // Fetch existing edit steps if project already has them
  const fetchEditSteps = useCallback(async () => {
    const { data } = await supabase
      .from("edit_steps")
      .select("steps")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.steps) {
      // Map existing steps to include status field
      const mapped = (data.steps as unknown as EditStep[]).map((s) => ({
        ...s,
        status: s.status ?? ("pending" as const),
      }));
      setSteps(mapped);
    }
  }, [id, supabase, setSteps]);

  useEffect(() => {
    if (project?.status === "ready" || project?.status === "done") {
      fetchEditSteps();
    }
  }, [project?.status, fetchEditSteps]);

  // SSE stream handler for /api/analyse
  const handleSubmitPrompt = useCallback(async () => {
    if (!prompt.trim() || !id) return;
    const currentPrompt = prompt;
    setPrompt("");
    clearAgent();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    try {
      const response = await fetch(`${apiUrl}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id, prompt: currentPrompt }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") {
              setAgentStatus(event.message);
            }
            if (event.type === "cut") {
              addStep({
                ...event.step,
                status: "pending" as const,
              });
            }
            if (event.type === "done") {
              setAgentStatus(null);
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch {
      setAgentStatus(null);
    }
  }, [prompt, id, clearAgent, setAgentStatus, addStep]);

  // Keyboard shortcuts
  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      const el = playerRef.current;
      if (!el) return;
      if (isPlaying) {
        el.pause();
      } else {
        el.play().catch(() => setIsPlaying(false));
      }
    },
    { enableOnFormTags: false },
    [isPlaying],
  );

  useHotkeys("j", () => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - 5);
    setCurrentTime(el.currentTime);
  });

  useHotkeys("l", () => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = el.currentTime + 5;
    setCurrentTime(el.currentTime);
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-base">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={24}
            strokeWidth={1.5}
            className="text-fg-muted animate-spin"
          />
          <span className="font-mono text-[12px] text-fg-muted">
            Loading editor…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content: video + agent panel */}
      <div className="flex-1 min-h-0">
        <Group orientation="horizontal" id="editor-h">
          {/* Video preview */}
          <Panel defaultSize="60%" minSize="35%">
            <VideoPreview playerRef={playerRef} />
          </Panel>

          <Separator className="w-px bg-border hover:bg-accent/40 active:bg-accent/60 transition-colors cursor-col-resize" />

          {/* Agent panel */}
          <Panel defaultSize="40%" minSize="25%">
            <AgentPanel />
          </Panel>
        </Group>
      </div>

      {/* Timeline — fixed 140px */}
      <Timeline playerRef={playerRef} />

      {/* Prompt bar — fixed 56px */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 border-t border-border"
        style={{ height: 56, background: "var(--bg-surface)" }}
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmitPrompt();
            }
          }}
          placeholder="What do you want to do with this video?"
          className="flex-1 bg-elevated border border-border rounded-md px-3 py-2 text-[13px] text-fg placeholder:text-fg-muted font-body outline-none focus:border-fg-muted transition-colors"
        />
        {prompt.trim() && (
          <button
            onClick={handleSubmitPrompt}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-fg text-[#080809] hover:bg-accent-hover transition-colors shrink-0"
          >
            <ArrowRight size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
