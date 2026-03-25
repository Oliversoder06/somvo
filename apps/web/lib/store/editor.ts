import { create } from "zustand";

export type EditStep = {
  id: string;
  type: "cut_silence" | "cut_filler" | "trim" | "caption";
  reason: string;
  startTime: number;
  endTime: number;
};

interface EditorState {
  projectId: string;
  projectName: string;
  status: "uploading" | "processing" | "ready" | "done" | "failed";
  videoUrl: string | null;
  steps: EditStep[];
  approvedStepIds: Set<string>;
  rejectedStepIds: Set<string>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  focusedStepIndex: number;

  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setStatus: (
    status: "uploading" | "processing" | "ready" | "done" | "failed",
  ) => void;
  setVideoUrl: (url: string | null) => void;
  setSteps: (steps: EditStep[]) => void;
  approveStep: (id: string) => void;
  rejectStep: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setFocusedStepIndex: (index: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  projectId: "",
  projectName: "",
  status: "uploading",
  videoUrl: null,
  steps: [],
  approvedStepIds: new Set(),
  rejectedStepIds: new Set(),
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  focusedStepIndex: 0,

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setStatus: (status) => set({ status }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setSteps: (steps) =>
    set({ steps, approvedStepIds: new Set(), rejectedStepIds: new Set() }),

  approveStep: (id) =>
    set((state) => {
      const approved = new Set(state.approvedStepIds);
      const rejected = new Set(state.rejectedStepIds);
      approved.add(id);
      rejected.delete(id);
      return { approvedStepIds: approved, rejectedStepIds: rejected };
    }),

  rejectStep: (id) =>
    set((state) => {
      const approved = new Set(state.approvedStepIds);
      const rejected = new Set(state.rejectedStepIds);
      rejected.add(id);
      approved.delete(id);
      return { approvedStepIds: approved, rejectedStepIds: rejected };
    }),

  approveAll: () =>
    set((state) => ({
      approvedStepIds: new Set(state.steps.map((s) => s.id)),
      rejectedStepIds: new Set(),
    })),

  rejectAll: () =>
    set((state) => ({
      rejectedStepIds: new Set(state.steps.map((s) => s.id)),
      approvedStepIds: new Set(),
    })),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setFocusedStepIndex: (index) => set({ focusedStepIndex: index }),
}));
