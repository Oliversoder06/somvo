import { create } from "zustand";

export type ProjectStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "done"
  | "failed";

export type EditStep = {
  id: string;
  type: "cut_silence" | "cut_filler" | "trim" | "caption";
  reason: string;
  startTime: number;
  endTime: number;
  status: "pending" | "approved" | "rejected";
};

interface EditorState {
  // Project
  projectId: string | null;
  projectName: string;
  status: ProjectStatus;
  videoUrl: string | null;
  duration: number;

  // Agent
  agentStatus: string | null;
  agentMessages: string[];

  // Steps
  steps: EditStep[];

  // Playback
  currentTime: number;
  isPlaying: boolean;
  previewMode: boolean;

  // Project setters
  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setStatus: (status: ProjectStatus) => void;
  setVideoUrl: (url: string | null) => void;
  setDuration: (duration: number) => void;

  // Agent setters
  setAgentStatus: (message: string | null) => void;
  addAgentMessage: (message: string) => void;
  clearAgent: () => void;

  // Step actions
  addStep: (step: EditStep) => void;
  setSteps: (steps: EditStep[]) => void;
  approveStep: (id: string) => void;
  rejectStep: (id: string) => void;
  updateStepBounds: (id: string, start: number, end: number) => void;
  approveAll: () => void;
  rejectAll: () => void;

  // Playback actions
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPreviewMode: (preview: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  // Project
  projectId: null,
  projectName: "",
  status: "ready",
  videoUrl: null,
  duration: 0,

  // Agent
  agentStatus: null,
  agentMessages: [],

  // Steps
  steps: [],

  // Playback
  currentTime: 0,
  isPlaying: false,
  previewMode: false,

  // Project setters
  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setStatus: (status) => set({ status }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setDuration: (duration) => set({ duration }),

  // Agent setters
  setAgentStatus: (message) =>
    set((state) => ({
      agentStatus: message,
      agentMessages: message
        ? [...state.agentMessages, message]
        : state.agentMessages,
    })),
  addAgentMessage: (message) =>
    set((state) => ({
      agentMessages: [...state.agentMessages, message],
    })),
  clearAgent: () => set({ agentStatus: null, agentMessages: [], steps: [] }),

  // Step actions
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  setSteps: (steps) => set({ steps }),
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
  updateStepBounds: (id, start, end) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === id ? { ...s, startTime: start, endTime: end } : s,
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

  // Playback actions
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPreviewMode: (preview) => set({ previewMode: preview }),
}));
