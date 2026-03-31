import { LoadingSpinner } from "@/components/loading-spinner";

export default function SettingsLoading() {
  return (
    <div style={{ paddingTop: "var(--space-16)" }}>
      <LoadingSpinner message="Loading settings\u2026" />
    </div>
  );
}
