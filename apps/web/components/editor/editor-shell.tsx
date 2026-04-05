"use client";

import { Topbar } from "@/components/topbar";

export function EditorShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: "100vh",
        background: "var(--bg-base)",
        position: "relative",
        padding: 6,
        gap: 6,
      }}
    >
      <div className="editor-glow" />
      <Topbar mode="editor" />
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{ position: "relative", zIndex: 1, gap: 6 }}
      >
        {children}
      </div>
    </div>
  );
}
