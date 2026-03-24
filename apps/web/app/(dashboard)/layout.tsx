import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
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
    <>
      <Topbar email={user?.email ?? null} plan={plan} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-300 p-8">{children}</div>
        </main>
      </div>
    </>
  );
}
