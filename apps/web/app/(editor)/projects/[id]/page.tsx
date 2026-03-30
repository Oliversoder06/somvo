"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { Loader2, PanelRightOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore, type EditStep } from "@/lib/store/editor";
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
  const setVideoUrl = useEditorStore((s) => s.setVideoUrl);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addStep = useEditorStore((s) => s.addStep);
  const addAgentMessage = useEditorStore((s) => s.addAgentMessage);
  const setAgentState = useEditorStore((s) => s.setAgentState);
  const clearSteps = useEditorStore((s) => s.clearSteps);

  const [prompt, setPrompt] = useState("");
  const agentPanelOpen = useEditorStore((s) => s.agentPanelOpen);
  const toggleAgentPanel = useEditorStore((s) => s.toggleAgentPanel);

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
  }, [project, setProjectId, setProjectName, setStatus]);

  // Generate signed URL
  useEffect(() => {
    if (!project?.raw_url) return;
    async function getSignedUrl() {
      const { data } = await supabase.storage
        .from("raw")
        .createSignedUrl(project!.raw_url!, 3600);
      if (data?.signedUrl) setVideoUrl(data.signedUrl);
    }
    getSignedUrl();
  }, [project?.raw_url, supabase.storage, setVideoUrl, project]);

  // Fetch existing edit steps
  useEffect(() => {
    if (!project || (project.status !== "ready" && project.status !== "done"))
      return;
    async function fetchSteps() {
      const { data } = await supabase
        .from("edit_steps")
        .select("steps")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data?.steps) {
        const mapped = (data.steps as unknown as EditStep[]).map((s) => ({
          ...s,
          status: s.status ?? ("pending" as const),
        }));
        mapped.forEach((s) => addStep(s));
        setAgentState("done");
      }
    }
    fetchSteps();
  }, [project?.status, id, supabase, addStep, setAgentState]);

  const pipelineVersion = useEditorStore((s) => s.pipelineVersion);

  // SSE stream handler
  const handleSubmitPrompt = useCallback(async () => {
    if (!prompt.trim() || !id) return;
    const currentPrompt = prompt;
    setPrompt("");

    setAgentState("streaming");
    clearSteps();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    try {
      const response = await fetch(`${apiUrl}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: id,
          prompt: currentPrompt,
          pipeline_version: pipelineVersion,
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") addAgentMessage(event.message);
            if (event.type === "cut")
              addStep({ ...event.step, status: "approved" as const });
            if (event.type === "done") setAgentState("done");
            if (event.type === "error") setAgentState("failed");
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch {
      setAgentState("failed");
    }
  }, [
    prompt,
    id,
    pipelineVersion,
    setAgentState,
    clearSteps,
    addAgentMessage,
    addStep,
  ]);

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
      <div
        className="flex items-center justify-center h-full"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={20}
            strokeWidth={1.5}
            className="animate-spin"
            style={{ color: "var(--accent)" }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            Loading editor...
          </span>
        </div>
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
