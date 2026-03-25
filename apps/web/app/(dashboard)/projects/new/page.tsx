import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";

export default function NewProjectPage() {
  return (
    <div className="fade-up">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/projects"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-fg-secondary hover:text-fg hover:border-fg-muted transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <h1 className="font-display text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.03em]">
          New Project
        </h1>
      </div>

      <div className="max-w-lg mx-auto">
        <UploadZone />
      </div>
    </div>
  );
}
