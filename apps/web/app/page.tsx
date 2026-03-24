import { Film } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";

export default function DashboardPage() {
  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.2] tracking-[-0.02em]">
          Projects
        </h1>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <Film size={24} strokeWidth={1.5} className="text-fg-muted" />
          <h2 className="font-display text-lg font-semibold text-fg">
            No projects yet
          </h2>
          <p className="text-fg-secondary text-[13px]">
            Upload a video to get started with AI-powered editing.
          </p>
        </div>

        <div className="mt-10 w-full max-w-lg">
          <UploadZone />
        </div>
      </div>
    </div>
  );
}
