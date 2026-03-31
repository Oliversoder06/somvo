"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectCard, type Project } from "@/components/project-card";
import { uploadVideo, ACCEPTED_TYPES, MAX_FILE_SIZE } from "@/lib/utils/upload";

export function ProjectsPageClient({ projects }: { projects: Project[] }) {
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

      const result = await uploadVideo(file);

      if ("error" in result) {
        setUploading(false);
        return;
      }

      router.push(`/projects/${result.projectId}`);
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
