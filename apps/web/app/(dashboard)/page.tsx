import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's first name from user_metadata
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? null;

  // Fetch last 3 projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, filename, status, created_at, user_id, raw_url")
    .order("created_at", { ascending: false })
    .limit(3);

  return <DashboardClient firstName={firstName} projects={projects ?? []} />;
}
