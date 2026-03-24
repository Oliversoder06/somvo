"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      setDeleting(false);
      setConfirming(false);
      return;
    }

    router.push("/projects");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="px-3 py-1.5 text-[13px] font-display font-medium text-fg-secondary hover:text-fg border border-border rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-[13px] font-display font-medium text-white bg-danger rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Confirm Delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-fg-secondary hover:text-danger hover:border-danger transition-colors"
      title="Delete project"
    >
      <Trash2 size={16} strokeWidth={1.5} />
    </button>
  );
}
