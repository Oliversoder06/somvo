"use client";

import { EditorTopbar } from "./editor-topbar";

export function EditorShell({
  email,
  plan,
  children,
}: {
  email: string | null;
  plan: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base">
      <EditorTopbar email={email} plan={plan} />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
