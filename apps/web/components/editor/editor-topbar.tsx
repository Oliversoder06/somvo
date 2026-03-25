"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/lib/store/editor";

export function EditorTopbar({
  email,
}: {
  email: string | null;
  plan: string;
}) {
  const router = useRouter();
  const projectName = useEditorStore((s) => s.projectName);
  const steps = useEditorStore((s) => s.steps);

  const hasApproved = steps.some((s) => s.status === "approved");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <header className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-border bg-surface">
      {/* Left: back + project name */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href="/projects"
          className="flex items-center justify-center w-7 h-7 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors"
          title="Back to projects"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
        </Link>
        <span className="font-mono text-[12px] text-fg-secondary truncate max-w-75">
          {projectName ?? "Untitled"}
        </span>
      </div>

      {/* Right: Export button + avatar */}
      <div className="flex items-center gap-2">
        <button
          disabled={!hasApproved}
          className="px-3.5 py-1.5 rounded-md bg-fg text-[#080809] font-display text-[11px] font-semibold tracking-[0.02em] hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Export
        </button>
        <button
          onClick={handleSignOut}
          className="w-6 h-6 rounded-md bg-elevated flex items-center justify-center text-fg-secondary text-[10px] font-display font-semibold hover:bg-border transition-colors"
          title="Sign out"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
