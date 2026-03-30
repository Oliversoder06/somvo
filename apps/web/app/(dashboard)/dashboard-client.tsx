"use client";

import Link from "next/link";
import { UploadZone } from "@/components/upload-zone";
import { ProjectCard, type Project } from "@/components/project-card";

export function DashboardClient({
  firstName,
  projects,
}: {
  firstName: string | null;
  projects: Project[];
}) {
  const hasProjects = projects.length > 0;

  const greeting = firstName ? `Good morning, ${firstName}.` : "Good morning.";

  return (
    <>
      {/* Atmospheric glow */}
      <div className="dashboard-bg" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "56px 48px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Greeting */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-muted)",
            marginBottom: 24,
          }}
        >
          {greeting}
        </span>

        {/* Drop zone */}
        <UploadZone />

        {/* Recent projects */}
        {hasProjects && (
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              marginTop: 44,
              paddingBottom: 40,
            }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 12 }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                Recent Projects
              </span>
              <Link
                href="/projects"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                }}
              >
                View all &rarr;
              </Link>
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {projects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
