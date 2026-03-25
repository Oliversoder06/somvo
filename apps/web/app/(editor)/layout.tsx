import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function EditorRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: string = "free";
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single();
    if (data) plan = (data as { plan: string }).plan;
  }

  return (
    <Providers>
      <EditorShell email={user?.email ?? null} plan={plan}>
        {children}
      </EditorShell>
    </Providers>
  );
}
