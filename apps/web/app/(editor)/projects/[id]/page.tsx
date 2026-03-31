"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useHotkeys } from "react-hotkeys-hook";
import { Loader2, PanelRightOpen } from "lucide-react";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore, type EditStep } from "@/lib/store/editor";
import { VideoPreview } from "@/components/editor/video-preview";
import { AgentPanel } from "@/components/editor/agent-panel";
import { Timeline } from "@/components/editor/timeline";
import { TransportBar } from "@/components/editor/transport-bar";
import { EditorSidebar } from "@/components/editor/editor-sidebar";

/**
 * Flush pending step changes to the DB — used on beforeunload.
 * Uses keepalive fetch to survive page unload. The access token is
 * cached by the caller so we don't need an async getSession() here.
 */
function flushStepsSync(
  projectId: string,
  steps: EditStep[],
  accessToken: string | null,
) {
  const apiBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = `${apiBase}/rest/v1/edit_steps?project_id=eq.${projectId}`;

  try {
    fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken ?? anonKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ steps }),
      keepalive: true,
    });
  } catch {
    // Best-effort — nothing we can do if this fails during unload
  }
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const setProjectId = useEditorStore((s) => s.setProjectId);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const setStatus = useEditorStore((s) => s.setStatus);
  const setVideoUrl = useEditorStore((s) => s.setVideoUrl);
  const setProcessedUrl = useEditorStore((s) => s.setProcessedUrl);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addStep = useEditorStore((s) => s.addStep);
  const addAgentMessage = useEditorStore((s) => s.addAgentMessage);
  const setAgentState = useEditorStore((s) => s.setAgentState);
  const clearSteps = useEditorStore((s) => s.clearSteps);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const setProcessedDuration = useEditorStore((s) => s.setProcessedDuration);
  const resetStore = useEditorStore((s) => s.reset);

  const [prompt, setPrompt] = useState("");
  const agentPanelOpen = useEditorStore((s) => s.agentPanelOpen);
  const toggleAgentPanel = useEditorStore((s) => s.toggleAgentPanel);

  // Reset store when project ID changes (prevents stale data from previous project)
  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevIdRef.current && prevIdRef.current !== id) {
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
  }, [project, setProjectId, setProjectName, setStatus, setProcessedUrl]);

  // Generate signed URL + auto-refresh before expiry
  const signedUrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!project?.raw_url) return;

    async function getSignedUrl() {
      const { data } = await supabase.storage
        .from("raw")
        .createSignedUrl(project!.raw_url!, 3600);
      if (data?.signedUrl) setVideoUrl(data.signedUrl);

      // Refresh 5 minutes before expiry (at 55 min mark)
      if (signedUrlTimer.current) clearTimeout(signedUrlTimer.current);
      signedUrlTimer.current = setTimeout(getSignedUrl, 55 * 60 * 1000);
    }
    getSignedUrl();

    return () => {
      if (signedUrlTimer.current) clearTimeout(signedUrlTimer.current);
    };
  }, [project?.raw_url, supabase.storage, setVideoUrl, project]);

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
        // Only enter review mode for projects that aren't already exported
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

  // ---- Persist step approval/rejection changes to DB ----
  // Uses debounce + flush-on-unmount + flush-on-beforeunload
  const steps = useEditorStore((s) => s.steps);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStepsRef = useRef<EditStep[] | null>(null);

  // Keep pending ref in sync for the beforeunload handler
  useEffect(() => {
    pendingStepsRef.current = steps;
  }, [steps]);

  // The actual sync function
  const syncStepsToDb = useCallback(
    async (stepsToSync: EditStep[]) => {
      if (!id || stepsToSync.length === 0) return;
      try {
        const { error } = await supabase
          .from("edit_steps")
          .update({
            steps: stepsToSync as unknown as Json[],
          })
          .eq("project_id", id);
        if (error) {
          console.error("Failed to sync edit steps:", error);
        }
      } catch (err) {
        console.error("Failed to sync edit steps:", err);
      }
    },
    [id, supabase],
  );

  // Debounced sync on step changes
  useEffect(() => {
    if (!id || !stepsLoaded.current || steps.length === 0) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncStepsToDb(steps);
      pendingStepsRef.current = null; // mark as flushed
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [steps, id, syncStepsToDb]);

  // Cache the access token for synchronous use in beforeunload
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        accessTokenRef.current = session?.access_token ?? null;
      },
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Flush on page unload (browser close, tab close, navigate away)
  useEffect(() => {
    function handleBeforeUnload() {
      if (
        pendingStepsRef.current &&
        pendingStepsRef.current.length > 0 &&
        stepsLoaded.current &&
        id
      ) {
        flushStepsSync(id, pendingStepsRef.current, accessTokenRef.current);
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Component unmount (e.g., navigating to another page within the app):
      // flush any pending debounced save immediately
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      if (
        pendingStepsRef.current &&
        pendingStepsRef.current.length > 0 &&
        stepsLoaded.current &&
        id
      ) {
        // Fire-and-forget — the component is already unmounting
        syncStepsToDb(pendingStepsRef.current);
      }
    };
  }, [id, supabase, syncStepsToDb]);

  const pipelineVersion = useEditorStore((s) => s.pipelineVersion);

  // SSE stream handler — with proper chunk buffering
  const handleSubmitPrompt = useCallback(async () => {
    if (!prompt.trim() || !id) return;
    const currentPrompt = prompt;
    setPrompt("");

    setAgentState("streaming");
    clearSteps();
    stepsLoaded.current = false;

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
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process only complete SSE events (terminated by \n\n)
        const parts = buffer.split("\n\n");
        // Keep the last (possibly incomplete) chunk in the buffer
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "status") addAgentMessage(event.message);
              if (event.type === "cut")
                addStep({ ...event.step, status: "approved" as const });
              if (event.type === "done") {
                setAgentState("done");
                stepsLoaded.current = true;
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
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") addAgentMessage(event.message);
            if (event.type === "cut")
              addStep({ ...event.step, status: "approved" as const });
            if (event.type === "done") {
              setAgentState("done");
              stepsLoaded.current = true;
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

      // Stream done — persist the auto-approved steps to DB immediately.
      // The backend saves steps as "pending" but the UI marks them "approved"
      // on arrival, so we overwrite here to keep the DB in sync with what the
      // user sees. Without this, a refresh would reload the "pending" state.
      if (stepsLoaded.current) {
        const finalSteps = useEditorStore.getState().steps;
        if (finalSteps.length > 0) {
          await syncStepsToDb(finalSteps);
          pendingStepsRef.current = null;
        }
        // Auto-switch to preview mode so user sees cuts immediately
        setPreviewMode(true);
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
    syncStepsToDb,
    setPreviewMode,
  ]);

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
