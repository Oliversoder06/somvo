import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
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
      <div className="flex h-screen overflow-hidden bg-surface">
        {/* Sidebar — shares surface bg with topbar */}
        <Sidebar />

        {/* Right column: topbar + inset content */}
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar email={user?.email ?? null} plan={plan} />

          {/* Inset main area with rounded top-left corner */}
          <main
            className="flex-1 overflow-y-auto rounded-tl-xl bg-base"
            id="main-content"
          >
            <div className="mx-auto max-w-300 p-8">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  );
}
