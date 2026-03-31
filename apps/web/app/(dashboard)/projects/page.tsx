import { createClient } from "@/lib/supabase/server";
import { ProjectsPageClient } from "./projects-client";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, filename, status, created_at, user_id, raw_url")
    .order("created_at", { ascending: false });

  return <ProjectsPageClient projects={projects ?? []} />;
}
