"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectCard, type Project } from "@/components/project-card";
import { createClient } from "@/lib/supabase/client";
import { extractThumbnail } from "@/lib/ffmpeg/thumbnail";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function extFromMime(mime: string) {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "mp4";
}

export function ProjectsPageClient({
  projects,
  userId,
}: {
  projects: Project[];
  userId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Re-fetch server data when the tab/window regains focus
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  // Also refresh once on mount to catch stale cache from back-navigation
  useEffect(() => {
    router.refresh();
  }, [router]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE)
        return;
      setUploading(true);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: project } = await supabase
        .from("projects")
        .insert({ user_id: user.id, filename: file.name, status: "uploading" })
        .select("id")
        .single();
      if (!project) return;

      const ext = extFromMime(file.type);
      const storagePath = `${user.id}/${project.id}/original.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("raw")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (uploadErr) {
        await supabase.from("projects").delete().eq("id", project.id);
        setUploading(false);
        return;
      }

      await supabase
        .from("projects")
        .update({ raw_url: storagePath, status: "ready" })
        .eq("id", project.id);

      try {
        const { thumbnailUrl, durationSeconds } = await extractThumbnail(file);
        if (thumbnailUrl) {
          const thumbResp = await fetch(thumbnailUrl);
          const thumbBlob = await thumbResp.blob();
          await supabase.storage
            .from("raw")
            .upload(`${user.id}/${project.id}/thumbnail.jpg`, thumbBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });
          URL.revokeObjectURL(thumbnailUrl);
        }
        if (durationSeconds > 0) {
          await supabase
            .from("projects")
            .update({ duration_seconds: Math.round(durationSeconds) })
            .eq("id", project.id);
        }
      } catch {
        // non-critical
      }

      router.push(`/projects/${project.id}`);
    },
    [router],
  );

  return (
    <>
      <div className="dashboard-bg" />
      <div style={{ position: "relative", zIndex: 1, padding: "32px 48px" }}>
        {/* Header row */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 24 }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Projects
          </h1>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gradient-bg"
            style={{
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
            }}
          >
            New project
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              thumbnailHeight={90}
            />
          ))}

          {/* Upload new card */}
          <label
            style={{
              border: "1px dashed var(--bg-border)",
              borderRadius: 9,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              minHeight: 140,
              transition: "border-color var(--transition-base)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,100,75,.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--bg-border)";
            }}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Plus
              size={18}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              New project
            </span>
          </label>
        </div>
      </div>
    </>
  );
}
