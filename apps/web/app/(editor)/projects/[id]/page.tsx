"use client";

import { useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useHotkeys } from "react-hotkeys-hook";
import { Loader2 } from "lucide-react";
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
  const steps = useEditorStore((s) => s.steps);
  const focusedStepIndex = useEditorStore((s) => s.focusedStepIndex);
  const approveStep = useEditorStore((s) => s.approveStep);
  const rejectStep = useEditorStore((s) => s.rejectStep);

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
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "processing" ? 3000 : false;
    },
  });

  // Sync project data into Zustand store
  useEffect(() => {
    if (!project) return;
    setProjectId(project.id);
    setProjectName(project.filename);
    setStatus(project.status);
  }, [project, setProjectId, setProjectName, setStatus]);

  // Generate signed URL when project is available
  useEffect(() => {
    if (!project?.raw_url) return;

    async function getSignedUrl() {
      const { data } = await supabase.storage
        .from("raw")
        .createSignedUrl(project!.raw_url!, 3600);
      if (data?.signedUrl) {
        setVideoUrl(data.signedUrl);
      }
    }

    getSignedUrl();
  }, [project?.raw_url, supabase.storage, setVideoUrl, project]);

  // Fetch edit steps when status becomes ready
  const fetchEditSteps = useCallback(async () => {
    const { data } = await supabase
      .from("edit_steps")
      .select("steps")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.steps) {
      setSteps(data.steps as unknown as EditStep[]);
    }
  }, [id, supabase, setSteps]);

  useEffect(() => {
    if (project?.status === "ready" || project?.status === "done") {
      fetchEditSteps();
    }
  }, [project?.status, fetchEditSteps]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`project-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status as
            | "uploading"
            | "processing"
            | "ready"
            | "done"
            | "failed";
          setStatus(newStatus);

          if (newStatus === "ready") {
            fetchEditSteps();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, supabase, setStatus, fetchEditSteps]);

  // Keyboard shortcuts
  useHotkeys(
    "space",
    (e) => {
      e.preventDefault();
      setIsPlaying(!isPlaying);
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

  useHotkeys("a", () => {
    if (steps.length > 0 && steps[focusedStepIndex]) {
      approveStep(steps[focusedStepIndex].id);
    }
  });

  useHotkeys("r", () => {
    if (steps.length > 0 && steps[focusedStepIndex]) {
      rejectStep(steps[focusedStepIndex].id);
    }
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
      {/* Vertical split: top panels + bottom timeline */}
      <Group orientation="vertical" id="editor-v">
        {/* Top section: Video preview + Agent panel */}
        <Panel defaultSize="75%" minSize="40%">
          <Group orientation="horizontal" id="editor-h">
            <Panel defaultSize="60%" minSize="30%">
              <VideoPreview playerRef={playerRef} />
            </Panel>
            <Separator className="w-[3px] bg-border hover:bg-accent/40 active:bg-accent/60 transition-colors cursor-col-resize" />
            <Panel defaultSize="40%" minSize="20%">
              <AgentPanel />
            </Panel>
          </Group>
        </Panel>

        {/* Resize handle between panels and timeline */}
        <Separator className="h-[3px] bg-border hover:bg-accent/40 active:bg-accent/60 transition-colors cursor-row-resize" />

        {/* Bottom section: Dual timeline — now resizable */}
        <Panel defaultSize="25%" minSize="10%">
          <Timeline playerRef={playerRef} />
        </Panel>
      </Group>
    </div>
  );
}
