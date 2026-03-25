"use client";

import { EditorTopbar } from "./editor-topbar";
import { EditorSidebar } from "./editor-sidebar";
import { useEditorStore } from "@/lib/store/editor";

export function EditorShell({
  email,
  plan,
  children,
}: {
  email: string | null;
  plan: string;
  children: React.ReactNode;
}) {
  const projectName = useEditorStore((s) => s.projectName);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Tool sidebar — shares surface bg */}
      <EditorSidebar />

      {/* Right column: topbar + inset content */}
      <div className="flex flex-col flex-1 min-w-0">
        <EditorTopbar
          email={email}
          plan={plan}
          projectName={projectName || null}
        />
        <div className="flex-1 min-h-0 overflow-hidden rounded-tl-xl bg-base">
          {children}
        </div>
      </div>
    </div>
  );
}
