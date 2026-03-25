"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TopbarProps {
  email: string | null;
  plan: string;
}

export function Topbar({ email, plan }: TopbarProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <header className="h-14 shrink-0 flex items-center justify-end px-6">
      {/* Right section */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded bg-accent-dim text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {plan}
        </span>
        <button
          onClick={handleSignOut}
          className="w-8 h-8 rounded-md bg-elevated flex items-center justify-center text-fg-secondary text-xs font-display font-semibold hover:bg-border transition-colors"
          title="Sign out"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
