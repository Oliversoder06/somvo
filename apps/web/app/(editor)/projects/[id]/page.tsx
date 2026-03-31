"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { PanelRightOpen } from "lucide-react";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore, type EditStep } from "@/lib/store/editor";
import { useSignedUrl } from "@/lib/hooks/use-signed-url";
import { useStepSync } from "@/lib/hooks/use-step-sync";
import { useAgentStream } from "@/lib/hooks/use-agent-stream";
import { useTranscript } from "@/lib/hooks/use-transcript";
import { LoadingSpinner } from "@/components/loading-spinner";
import { VideoPreview } from "@/components/editor/video-preview";
import { AgentPanel } from "@/components/editor/agent-panel";
import { Timeline } from "@/components/editor/timeline";
import { TransportBar } from "@/components/editor/transport-bar";
import { EditorSidebar } from "@/components/editor/editor-sidebar";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const setProjectId = useEditorStore((s) => s.setProjectId);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const setStatus = useEditorStore((s) => s.setStatus);
  const setProcessedUrl = useEditorStore((s) => s.setProcessedUrl);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addStep = useEditorStore((s) => s.addStep);
  const setAgentState = useEditorStore((s) => s.setAgentState);
  const clearSteps = useEditorStore((s) => s.clearSteps);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const setProcessedDuration = useEditorStore((s) => s.setProcessedDuration);
  const resetStore = useEditorStore((s) => s.reset);

  const [prompt, setPrompt] = useState("");
  const agentPanelOpen = useEditorStore((s) => s.agentPanelOpen);
  const toggleAgentPanel = useEditorStore((s) => s.toggleAgentPanel);

  // Reset store when project ID changes
  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevIdRef.current !== id) {
      resetStore();
    }
    prevIdRef.current = id;
  }, [id, resetStore]);

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

  // Sync project data into Zustand store
  useEffect(() => {
    if (!project) return;
    setProjectId(project.id);
    setProjectName(
      project.filename ??
        project.raw_url?.split("/").pop()?.split("?")[0] ??
        "Untitled",
    );
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
    if (project.processed_url) setProcessedUrl(project.processed_url);
    if (project.processed_duration != null)
      setProcessedDuration(project.processed_duration);
  }, [
    project,
    setProjectId,
    setProjectName,
    setStatus,
    setProcessedUrl,
    setProcessedDuration,
  ]);

  // Signed URL management
  useSignedUrl(project?.raw_url);

  // Load transcript + caption style from DB
  useTranscript(id);

  // Fetch existing edit steps
  const stepsLoaded = useRef(false);
  useEffect(() => {
    if (!project || (project.status !== "ready" && project.status !== "done"))
      return;
    if (stepsLoaded.current) return;
    async function fetchSteps() {
      const { data, error } = await supabase
        .from("edit_steps")
        .select("steps")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch edit steps:", error);
        return;
      }

      if (data?.steps) {
        clearSteps();
        const mapped = (data.steps as unknown as EditStep[]).map((s) => ({
          ...s,
          status: s.status ?? ("pending" as const),
        }));
        mapped.forEach((s) => addStep(s));
        if (project!.status !== "done") {
          setAgentState("done");
          setPreviewMode(true);
        }
        stepsLoaded.current = true;
      }
    }
    fetchSteps();
  }, [
    project,
    id,
    supabase,
    addStep,
    setAgentState,
    clearSteps,
    setPreviewMode,
  ]);

  // Step sync (debounce + beforeunload flush)
  const { syncStepsToDb, pendingStepsRef } = useStepSync(id, stepsLoaded);

  // SSE agent stream
  const handleAgentStream = useAgentStream(
    id,
    stepsLoaded,
    syncStepsToDb,
    pendingStepsRef,
  );

  const handleSubmitPrompt = useCallback(async () => {
    if (!prompt.trim()) return;
    const currentPrompt = prompt;
    setPrompt("");
    await handleAgentStream(currentPrompt);
  }, [prompt, handleAgentStream]);

  // Discard all proposed cuts and return to clean state
  const handleDiscard = useCallback(async () => {
    clearSteps();
    setPreviewMode(false);
    setProcessedDuration(null);
    stepsLoaded.current = false;
    if (id) {
      try {
        await supabase
          .from("edit_steps")
          .update({ steps: [] as Json[] })
          .eq("project_id", id);
      } catch (err) {
        console.error("Failed to clear edit steps:", err);
      }
    }
  }, [id, supabase, clearSteps, setPreviewMode, setProcessedDuration]);

  // Keyboard shortcuts
  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      const el = playerRef.current;
      if (!el) return;
      if (isPlaying) el.pause();
      else el.play().catch(() => setIsPlaying(false));
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

  const handleSeek = useCallback(
    (time: number) => {
      const el = playerRef.current;
      if (!el) return;
      el.currentTime = time;
      setCurrentTime(time);
      el.play().catch(() => {});
    },
    [playerRef, setCurrentTime],
  );

  if (isLoading) {
    return (
      <div style={{ background: "var(--bg-base)", height: "100%" }}>
        <LoadingSpinner message="Loading editor..." />
      </div>
    );
  }

  return (
    <div
      className="flex"
      style={{
        height: "100%",
        background: "var(--bg-base)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Left icon sidebar */}
      <EditorSidebar />

      {/* ---- Centre: video + transport + timeline stacked ---- */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Video canvas - fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          <VideoPreview playerRef={playerRef} />
        </div>

        {/* Transport bar */}
        <TransportBar playerRef={playerRef} />

        {/* Timeline */}
        <Timeline playerRef={playerRef} />
      </div>

      {/* Right director/agent panel - full height, collapsible */}
      <AgentPanel
        onSeek={handleSeek}
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmitPrompt={handleSubmitPrompt}
        onDiscard={handleDiscard}
      />

      {/* Collapsed panel open button */}
      {!agentPanelOpen && (
        <button
          onClick={toggleAgentPanel}
          title="Open Director panel"
          style={{
            position: "absolute",
            top: 60,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--bg-border)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            transition: "all 150ms ease",
          }}
        >
          <PanelRightOpen size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
