import { TopbarNav } from "@/components/topbar-nav";
import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user profile for plan badge
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
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: "var(--bg-base)" }}
      >
        <TopbarNav email={user?.email ?? null} plan={plan} />
        <main className="flex-1 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>
    </Providers>
  );
}
