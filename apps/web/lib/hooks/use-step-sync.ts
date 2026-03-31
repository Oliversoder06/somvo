import { useEffect, useRef, useCallback } from "react";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore, type EditStep } from "@/lib/store/editor";

function flushStepsSync(
  projectId: string,
  steps: EditStep[],
  accessToken: string | null,
) {
  const apiBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = `${apiBase}/rest/v1/edit_steps?project_id=eq.${projectId}`;

  try {
    fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken ?? anonKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ steps }),
      keepalive: true,
    });
  } catch {
    // Best-effort — nothing we can do if this fails during unload
  }
}

export function useStepSync(
  projectId: string | undefined,
  stepsLoadedRef: React.MutableRefObject<boolean>,
) {
  const supabase = createClient();
  const steps = useEditorStore((s) => s.steps);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStepsRef = useRef<EditStep[] | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    pendingStepsRef.current = steps;
  }, [steps]);

  const syncStepsToDb = useCallback(
    async (stepsToSync: EditStep[]) => {
      if (!projectId || stepsToSync.length === 0) return;
      try {
        const { error } = await supabase
          .from("edit_steps")
          .update({
            steps: stepsToSync as unknown as Json[],
          })
          .eq("project_id", projectId);
        if (error) {
          console.error("Failed to sync edit steps:", error);
        }
      } catch (err) {
        console.error("Failed to sync edit steps:", err);
      }
    },
    [projectId, supabase],
  );

  // Debounced sync on step changes
  useEffect(() => {
    if (!projectId || !stepsLoadedRef.current || steps.length === 0) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncStepsToDb(steps);
      pendingStepsRef.current = null;
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [steps, projectId, syncStepsToDb, stepsLoadedRef]);

  // Cache access token for synchronous use in beforeunload
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        accessTokenRef.current = session?.access_token ?? null;
      },
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Flush on page unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (
        pendingStepsRef.current &&
        pendingStepsRef.current.length > 0 &&
        stepsLoadedRef.current &&
        projectId
      ) {
        flushStepsSync(
          projectId,
          pendingStepsRef.current,
          accessTokenRef.current,
        );
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      if (
        pendingStepsRef.current &&
        pendingStepsRef.current.length > 0 &&
        stepsLoadedRef.current &&
        projectId
      ) {
        syncStepsToDb(pendingStepsRef.current);
      }
    };
  }, [projectId, supabase, syncStepsToDb, stepsLoadedRef]);

  return { syncStepsToDb, pendingStepsRef };
}
