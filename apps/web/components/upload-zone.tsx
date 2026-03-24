"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // TODO: Handle file upload
  }, []);

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        block cursor-pointer rounded-xl border-[1.5px] border-dashed py-16 px-8 text-center
        transition-[border-color,background] duration-150
        ${
          isDragOver
            ? "border-accent bg-[#f5a62310]"
            : "border-border hover:border-accent hover:bg-[#f5a62310]"
        }
      `}
    >
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
      />
      <div className="flex flex-col items-center gap-3">
        <Upload size={32} strokeWidth={1.5} className="text-fg-muted" />
        <span className="font-display text-fg font-semibold">
          Drop your video here
        </span>
        <span className="text-fg-secondary text-[13px]">
          MP4, MOV, or WebM — up to 500 MB
        </span>
      </div>
    </label>
  );
}
