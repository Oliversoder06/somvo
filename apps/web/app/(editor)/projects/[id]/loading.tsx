import { LoadingSpinner } from "@/components/loading-spinner";

export default function EditorLoading() {
  return (
    <div className="h-full" style={{ background: "var(--bg-base)" }}>
      <LoadingSpinner message="Loading editor\u2026" />
    </div>
  );
}
