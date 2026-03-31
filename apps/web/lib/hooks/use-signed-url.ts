import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/lib/store/editor";

export function useSignedUrl(rawUrl: string | null | undefined) {
  const setVideoUrl = useEditorStore((s) => s.setVideoUrl);
  const supabase = createClient();
  const signedUrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!rawUrl) return;

    async function getSignedUrl() {
      const { data } = await supabase.storage
        .from("raw")
        .createSignedUrl(rawUrl!, 3600);
      if (data?.signedUrl) setVideoUrl(data.signedUrl);

      if (signedUrlTimer.current) clearTimeout(signedUrlTimer.current);
      signedUrlTimer.current = setTimeout(getSignedUrl, 55 * 60 * 1000);
    }
    getSignedUrl();

    return () => {
      if (signedUrlTimer.current) clearTimeout(signedUrlTimer.current);
    };
  }, [rawUrl, supabase.storage, setVideoUrl]);
}
