import { LoadingSpinner } from "@/components/loading-spinner";

export default function ProjectsLoading() {
  return (
    <div style={{ paddingTop: "var(--space-16)" }}>
      <LoadingSpinner message="Loading projects\u2026" />
    </div>
  );
}
