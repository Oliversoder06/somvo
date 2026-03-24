import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // After exchanging the code, ensure a row exists in public.users
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const row: Database["public"]["Tables"]["users"]["Insert"] = {
          id: user.id,
          email: user.email!,
          plan: "free",
        };
        await supabase.from("users").upsert(row, { onConflict: "id" });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to an error page or login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
