"use client";

import { EditorTopbar } from "./editor-topbar";

export function EditorShell({
  children,
}: {
  email?: string | null;
  plan?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: "100vh",
        background: "var(--bg-base)",
        position: "relative",
      }}
    >
      <div className="editor-glow" />
      <EditorTopbar />
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{ position: "relative", zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}
