import { create } from "zustand";

export type StepStatus = "pending" | "approved" | "rejected";

export type EditStep = {
  id: string;
  type: "cut_silence" | "cut_filler" | "caption";
  reason: string;
  startTime: number;
  endTime: number;
  status: StepStatus;
};

export type AgentState = "idle" | "streaming" | "done" | "failed";

interface EditorStore {
  projectId: string | null;
  projectName: string;
  status: "uploading" | "processing" | "ready" | "done" | "failed";
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  previewMode: boolean;

  agentState: AgentState;
  agentMessages: string[];
  steps: EditStep[];

  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setStatus: (s: EditorStore["status"]) => void;
  setVideoUrl: (url: string) => void;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setPreviewMode: (m: boolean) => void;
  timelineZoom: number;
  setTimelineZoom: (z: number) => void;
  timelineHeight: number;
  setTimelineHeight: (h: number) => void;
  agentPanelOpen: boolean;
  toggleAgentPanel: () => void;
  setAgentState: (s: AgentState) => void;
  addAgentMessage: (m: string) => void;
  addStep: (step: EditStep) => void;
  approveStep: (id: string) => void;
  rejectStep: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  clearSteps: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  projectId: null,
  projectName: "Untitled",
  status: "ready",
  videoUrl: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  previewMode: false,
  timelineZoom: 1,
  timelineHeight: 200,
  agentPanelOpen: true,

  agentState: "idle",
  agentMessages: [],
  steps: [],

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setStatus: (s) => set({ status: s }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setDuration: (d) => set({ duration: d }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setPreviewMode: (m) => set({ previewMode: m }),
  setTimelineZoom: (z) => set({ timelineZoom: Math.max(1, Math.min(20, z)) }),
  setTimelineHeight: (h) =>
    set({ timelineHeight: Math.max(120, Math.min(400, h)) }),
  toggleAgentPanel: () =>
    set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
  setAgentState: (s) => set({ agentState: s }),
  addAgentMessage: (m) =>
    set((state) => ({ agentMessages: [...state.agentMessages, m] })),
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  approveStep: (id) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === id ? { ...s, status: "approved" as const } : s,
      ),
    })),
  rejectStep: (id) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === id ? { ...s, status: "rejected" as const } : s,
      ),
    })),
  approveAll: () =>
    set((state) => ({
      steps: state.steps.map((s) => ({ ...s, status: "approved" as const })),
    })),
  rejectAll: () =>
    set((state) => ({
      steps: state.steps.map((s) => ({ ...s, status: "rejected" as const })),
    })),
  clearSteps: () => set({ steps: [], agentMessages: [], agentState: "idle" }),
}));
