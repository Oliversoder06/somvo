"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/lib/store/editor";

export function EditorTopbar() {
  const steps = useEditorStore((s) => s.steps);
  const status = useEditorStore((s) => s.status);
  const filename = useEditorStore((s) => s.projectName);

  const processedUrl = useEditorStore((s) => s.processedUrl);
  const projectId = useEditorStore((s) => s.projectId);
  const [isExporting, setIsExporting] = useState(false);

  const hasApproved = steps.some((s) => s.status === "approved");
  const exportDisabled = !hasApproved || status !== "done" || isExporting;

  async function handleExport() {
    if (exportDisabled) return;
    setIsExporting(true);
    try {
      const supabase = createClient();
      // Try stored processedUrl, fall back to convention
      const storagePath =
        processedUrl ||
        (projectId
          ? await supabase
              .from("projects")
              .select("processed_url")
              .eq("id", projectId)
              .single()
              .then((r) => r.data?.processed_url)
          : null);
      if (!storagePath) {
        alert("Processed video not found");
        return;
      }
      const { data } = await supabase.storage
        .from("processed")
        .createSignedUrl(storagePath, 300);
      if (!data?.signedUrl) {
        alert("Could not generate download link");
        return;
      }
      // Download via hidden anchor
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = filename || "export.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Export failed — try again");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <header
      className="shrink-0 flex items-center justify-between px-4"
      style={{
        height: 48,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--bg-border)",
      }}
    >
      {/* Left: Back */}
      <Link
        href="/projects"
        className="flex items-center gap-1.5 editor-back-link"
        style={{
          color: "var(--text-muted)",
          textDecoration: "none",
          transition: "color 150ms ease",
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={15} strokeWidth={1.5} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Projects
        </span>
      </Link>

      {/* Centre: Filename */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "0 16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </span>
      </div>

      {/* Right: Export button */}
      <button
        disabled={exportDisabled}
        onClick={handleExport}
        className={exportDisabled ? "" : "gradient-bg"}
        style={{
          color: exportDisabled ? "var(--text-muted)" : "#fff",
          fontFamily: "var(--font-display)",
          fontSize: 11,
          fontWeight: 700,
          padding: "6px 14px",
          borderRadius: 7,
          border: exportDisabled ? "1px solid var(--bg-border)" : "none",
          cursor: exportDisabled ? "not-allowed" : "pointer",
          background: exportDisabled ? "transparent" : undefined,
          opacity: exportDisabled ? 0.4 : 1,
          display: "flex",
          alignItems: "center",
          gap: 5,
          transition: "all 150ms ease",
          boxShadow: exportDisabled ? "none" : "0 0 16px rgba(255,106,82,.2)",
        }}
      >
        {isExporting ? (
          <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Download size={12} strokeWidth={1.5} />
        )}
        {isExporting ? "Downloading..." : "Export"}
      </button>
    </header>
  );
}
