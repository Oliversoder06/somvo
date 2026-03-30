"use client";

import { Film } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

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
  });
}

export type Project = {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  user_id?: string;
  raw_url?: string | null;
};

export function ProjectCard({
  project,
  index = 0,
  thumbnailHeight = 68,
}: {
  project: Project;
  index?: number;
  thumbnailHeight?: number;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!project.user_id || !project.id) return;
    const supabase = createClient();
    const path = `${project.user_id}/${project.id}/thumbnail.jpg`;
    supabase.storage
      .from("raw")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setThumbnailUrl(data.signedUrl);
      });
  }, [project.user_id, project.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Link
        href={`/projects/${project.id}`}
        className="block overflow-hidden cursor-pointer"
        style={{
          background: "rgba(255,255,255,.025)",
          border: "1px solid var(--bg-border)",
          borderRadius: 9,
          transition: "border-color var(--transition-base), background var(--transition-base)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,100,75,.2)";
          e.currentTarget.style.background = "rgba(255,255,255,.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--bg-border)";
          e.currentTarget.style.background = "rgba(255,255,255,.025)";
        }}
      >
        {/* Thumbnail */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            height: thumbnailHeight,
            background: "var(--bg-elevated)",
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={project.filename}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Film
              size={18}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
          )}
        </div>

        {/* Card body */}
        <div style={{ padding: "9px 11px" }}>
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {project.filename}
          </p>
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 4 }}
          >
            <span className={`badge badge-${project.status}`}>
              <span
                className={`inline-block w-1 h-1 rounded-full ${project.status === "processing" ? "badge-dot" : ""}`}
                style={{ background: "currentColor" }}
              />
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              {formatDate(project.created_at)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
