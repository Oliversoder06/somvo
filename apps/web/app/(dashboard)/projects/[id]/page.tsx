import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteProjectButton } from "@/components/delete-project-button";
import {
  ArrowLeft,
  Film,
  Clock,
  FileVideo,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: typeof Loader2 }
> = {
  uploading: { label: "Uploading", badge: "badge-uploading", icon: Loader2 },
  processing: {
    label: "Processing",
    badge: "badge-processing",
    icon: Loader2,
  },
  ready: { label: "Ready", badge: "badge-ready", icon: Sparkles },
  done: { label: "Done", badge: "badge-done", icon: CheckCircle2 },
  failed: { label: "Failed", badge: "badge-failed", icon: AlertCircle },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) notFound();

  const statusConf = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.uploading;

  return (
    <div className="fade-up">
      {/* Back + header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/projects"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-fg-secondary hover:text-fg hover:border-fg-muted transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[1.5rem] font-bold leading-[1.2] tracking-[-0.02em] truncate">
            {project.filename}
          </h1>
        </div>
        <DeleteProjectButton projectId={project.id} />
      </div>

      {/* Info bar */}
      <div className="card flex flex-wrap items-center gap-6 mb-8">
        <span className={`badge ${statusConf.badge}`}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {statusConf.label}
        </span>

        <div className="flex items-center gap-2 text-fg-secondary text-[13px]">
          <FileVideo size={14} strokeWidth={1.5} />
          <span className="font-mono text-[12px]">{project.filename}</span>
        </div>

        <div className="flex items-center gap-2 text-fg-secondary text-[13px]">
          <Clock size={14} strokeWidth={1.5} />
          <span className="font-mono text-[12px]">
            {formatDuration(project.duration_seconds)}
          </span>
        </div>

        <span className="font-mono text-[12px] text-fg-muted ml-auto">
          {formatDate(project.created_at)}
        </span>
      </div>

      {/* Status-dependent content */}
      {(project.status === "uploading" || project.status === "processing") && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <Loader2
            size={32}
            strokeWidth={1.5}
            className="text-info animate-spin mb-4"
          />
          <p className="font-display text-fg font-semibold">
            {project.status === "uploading"
              ? "Upload in progress…"
              : "Processing your video…"}
          </p>
          <p className="text-fg-secondary text-[13px] mt-2 max-w-sm">
            {project.status === "uploading"
              ? "Your file is being uploaded. This page will update when it's ready."
              : "Our AI is analyzing your video for silence, speech, and edit points. This may take a few minutes."}
          </p>
        </div>
      )}

      {project.status === "failed" && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle
            size={32}
            strokeWidth={1.5}
            className="text-danger mb-4"
          />
          <p className="font-display text-fg font-semibold">
            Processing failed
          </p>
          <p className="text-fg-secondary text-[13px] mt-2 max-w-sm">
            Something went wrong while processing this video. You can try
            uploading it again.
          </p>
        </div>
      )}

      {(project.status === "ready" || project.status === "done") && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Video preview placeholder */}
          <div className="lg:col-span-3 card flex flex-col">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-4">
              Preview
            </h2>
            <div className="flex-1 flex items-center justify-center min-h-[300px] rounded-lg bg-elevated">
              <div className="flex flex-col items-center gap-3 text-center">
                <Film size={32} strokeWidth={1.5} className="text-fg-muted" />
                <p className="font-display text-fg-secondary text-[13px]">
                  Video player coming soon
                </p>
              </div>
            </div>
          </div>

          {/* Agent reasoning panel placeholder */}
          <div className="lg:col-span-2 card flex flex-col">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-4">
              Edit Steps
            </h2>
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-3 text-center">
                <Sparkles
                  size={24}
                  strokeWidth={1.5}
                  className="text-fg-muted"
                />
                <p className="font-display text-fg-secondary text-[13px]">
                  Agent reasoning panel coming soon
                </p>
              </div>
            </div>
          </div>

          {/* Timeline placeholder */}
          <div className="lg:col-span-5 card">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-4">
              Timeline
            </h2>
            <div className="h-40 rounded-lg bg-elevated flex items-center justify-center">
              <p className="font-display text-fg-secondary text-[13px]">
                Dual timeline coming soon
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
