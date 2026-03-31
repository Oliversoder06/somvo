import { createClient } from "@/lib/supabase/client";

export async function handleOAuth(provider: "google" | "github") {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
