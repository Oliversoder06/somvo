import { Film } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UploadZone } from "@/components/upload-zone";

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  processing: "Processing",
  ready: "Ready",
  done: "Done",
  failed: "Failed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, filename, status, created_at")
    .order("created_at", { ascending: false });

  const hasProjects = projects && projects.length > 0;

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.2] tracking-[-0.02em]">
          Projects
        </h1>
      </div>

      {hasProjects ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="card card-hover block"
            >
              {/* Thumbnail placeholder */}
              <div className="flex items-center justify-center h-28 rounded-md bg-elevated mb-4">
                <Film size={24} strokeWidth={1.5} className="text-fg-muted" />
              </div>

              {/* Filename */}
              <p className="font-display text-[1.125rem] font-semibold text-fg truncate leading-[1.2]">
                {project.filename}
              </p>

              {/* Status + date row */}
              <div className="flex items-center justify-between mt-3">
                <span className={`badge badge-${project.status}`}>
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "currentColor" }}
                  />
                  {STATUS_LABELS[project.status] ?? project.status}
                </span>
                <span className="font-mono text-[12px] text-fg-secondary">
                  {formatDate(project.created_at)}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 max-w-xs text-center">
            <Film size={24} strokeWidth={1.5} className="text-fg-muted" />
            <h2 className="font-display text-lg font-semibold text-fg">
              No projects yet
            </h2>
            <p className="text-fg-secondary text-[13px]">
              Upload a video to get started with AI-powered editing.
            </p>
          </div>

          <div className="mt-10 w-full max-w-lg">
            <UploadZone />
          </div>
        </div>
      )}
    </div>
  );
}
