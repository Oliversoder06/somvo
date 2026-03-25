"use client";

import { EditorTopbar } from "./editor-topbar";
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
    <div className="flex flex-col h-screen overflow-hidden bg-base">
      <EditorTopbar
        email={email}
        plan={plan}
        projectName={projectName || null}
      />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
