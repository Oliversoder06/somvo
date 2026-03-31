import { Loader2 } from "lucide-react";

export function LoadingSpinner({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          size={20}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: "var(--accent)" }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
