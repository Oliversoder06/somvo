"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Keyboard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/lib/store/editor";

export function EditorTopbar({
  email,
  plan,
  projectName,
}: {
  email: string | null;
  plan: string;
  projectName: string | null;
}) {
  const router = useRouter();
  const status = useEditorStore((s) => s.status);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "U";

  const statusLabel: Record<string, { text: string; className: string }> = {
    uploading: { text: "Uploading", className: "text-fg-muted" },
    processing: { text: "Processing", className: "text-info" },
    ready: { text: "Ready", className: "text-success" },
    done: { text: "Done", className: "text-success" },
    failed: { text: "Failed", className: "text-danger" },
  };

  const s = statusLabel[status] ?? statusLabel.uploading;

  return (
    <header className="h-11 shrink-0 flex items-center justify-between px-3">
      {/* Left: back + logo + project name */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href="/projects"
          className="flex items-center justify-center w-7 h-7 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors"
          title="Back to projects"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
        </Link>

        {projectName && (
          <>
            <span className="text-fg-muted text-[11px]">/</span>
            <span className="font-mono text-[11px] text-fg-secondary truncate max-w-48">
              {projectName}
            </span>
          </>
        )}

        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${s.className}`}
        >
          {s.text}
        </span>
      </div>

      {/* Right: shortcuts hint + plan + avatar */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1 text-fg-muted">
          <Keyboard size={12} strokeWidth={1.5} />
          <span className="font-mono text-[10px]">Space · J/L · A/R</span>
        </div>

        <div className="w-px h-4 bg-border" />

        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-accent-dim text-accent">
          <span className="w-1 h-1 rounded-full bg-current" />
          {plan}
        </span>
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
