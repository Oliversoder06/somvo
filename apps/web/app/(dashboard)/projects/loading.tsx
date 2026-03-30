import { Loader2 } from "lucide-react";

export default function ProjectsLoading() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ paddingTop: "var(--space-16)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2
          size={24}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: "var(--text-muted)" }}
        />
        <span
          className="font-mono text-[12px]"
          style={{ color: "var(--text-muted)" }}
        >
          Loading projects…
        </span>
      </div>
    </div>
  );
}
