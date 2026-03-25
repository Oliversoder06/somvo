import { Loader2 } from "lucide-react";

export default function EditorLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-base">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          size={24}
          strokeWidth={1.5}
          className="text-fg-muted animate-spin"
        />
        <span className="font-mono text-[12px] text-fg-muted">
          Loading editor…
        </span>
      </div>
    </div>
  );
}
