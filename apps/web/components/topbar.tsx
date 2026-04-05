"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEditorStore } from "@/lib/store/editor";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
];

type TopbarProps =
  | { mode: "editor" }
  | { mode: "dashboard"; email: string | null; plan: string };

export function Topbar(props: TopbarProps) {
  if (props.mode === "editor") return <EditorContent />;
  return <DashboardContent email={props.email} plan={props.plan} />;
}

/* ─── Editor Topbar ─── */

function EditorContent() {
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
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "export.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Export failed — try again");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <header
      className="shrink-0 flex items-center justify-between"
      style={{
        height: 52,
        background: "transparent",
        padding: "0 20px",
        position: "relative",
      }}
    >
      {/* Left: Back */}
      <Link
        href="/projects"
        className="flex items-center gap-1 editor-back-link"
        style={{
          color: "var(--text-muted)",
          textDecoration: "none",
          transition: "color 150ms ease",
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          Back
        </span>
      </Link>

      {/* Centre: Filename */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          maxWidth: "40%",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}
        >
          {filename}
        </span>
      </div>

      {/* Right: Export button */}
      <button
        disabled={exportDisabled}
        onClick={handleExport}
        style={{
          color: exportDisabled ? "var(--text-muted)" : "#fff",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          padding: "6px 16px",
          borderRadius: 12,
          border: exportDisabled ? "1px solid var(--panel-border)" : "none",
          cursor: exportDisabled ? "not-allowed" : "pointer",
          background: exportDisabled
            ? "transparent"
            : "linear-gradient(135deg, var(--accent-from), var(--accent-to))",
          opacity: exportDisabled ? 0.35 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 150ms ease",
          boxShadow: exportDisabled
            ? "none"
            : "0 2px 12px rgba(255,106,82,.15)",
          letterSpacing: "0.01em",
        }}
      >
        {isExporting ? (
          <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Download size={12} strokeWidth={1.5} />
        )}
        {isExporting ? "Exporting..." : "Export"}
      </button>
    </header>
  );
}

/* ─── Dashboard Topbar ─── */

function DashboardContent({
  email,
  plan,
}: {
  email: string | null;
  plan: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <header
      className="shrink-0 flex items-center justify-between px-6"
      style={{
        height: 52,
        background: "transparent",
      }}
    >
      {/* Left: Logo */}
      <Link href="/">
        <Logo height={20} />
      </Link>

      {/* Centre: Nav links */}
      <nav className="flex items-center gap-5">
        {navLinks.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                transition: "color var(--transition-base)",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Plan badge + Avatar */}
      <div className="flex items-center gap-3">
        <span
          className="badge"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid rgba(255,106,82,.15)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {plan.toUpperCase()}
        </span>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-display)",
            fontSize: 11,
            fontWeight: 600,
            transition: "background var(--transition-base)",
          }}
          title="Sign out"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
