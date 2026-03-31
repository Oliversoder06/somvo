"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { uploadVideo, ACCEPTED_TYPES, MAX_FILE_SIZE } from "@/lib/utils/upload";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string; progress: number }
  | { phase: "error"; message: string };

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setState({
          phase: "error",
          message: "Unsupported file type. Use MP4, MOV, or WebM.",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setState({
          phase: "error",
          message: "File too large. Maximum size is 500 MB.",
        });
        return;
      }

      setState({ phase: "uploading", filename: file.name, progress: 0 });

      const result = await uploadVideo(file, (progress) => {
        setState({ phase: "uploading", filename: file.name, progress });
      });

      if ("error" in result) {
        setState({ phase: "error", message: result.error });
        return;
      }

      router.push(`/projects/${result.projectId}`);
    },
    [router],
  );

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || state.phase === "uploading") return;
      uploadFile(file);
    },
    [uploadFile, state.phase],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  if (state.phase === "uploading") {
    return (
      <div
        className="dropzone"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "rgba(255,255,255,.025)",
          border: "1.5px solid rgba(255,255,255,.1)",
          borderRadius: 14,
          padding: "52px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Loader2
          size={20}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: "var(--accent)" }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Uploading {state.filename}
        </span>
        <div
          style={{
            width: 200,
            height: 4,
            borderRadius: 2,
            background: "var(--bg-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              background: "var(--accent)",
              width: state.progress === 0 ? "60%" : "100%",
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setState({ phase: "idle" })}
        onKeyDown={(e) => e.key === "Enter" && setState({ phase: "idle" })}
        className="dropzone"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "rgba(255,255,255,.025)",
          border: "1.5px solid var(--danger)",
          borderRadius: 14,
          padding: "52px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AlertCircle
          size={20}
          strokeWidth={1.5}
          style={{ color: "var(--danger)" }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Upload failed
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          {state.message}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--accent)",
          }}
        >
          Click to try again
        </span>
      </div>
    );
  }

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="dropzone"
      style={{
        width: "100%",
        maxWidth: 520,
        background: isDragOver
          ? "rgba(255,80,80,.03)"
          : "rgba(255,255,255,.025)",
        border: isDragOver
          ? "1.5px solid rgba(255,100,75,.35)"
          : "1.5px dashed rgba(255,255,255,.1)",
        borderRadius: 14,
        padding: "52px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition:
          "border-color var(--transition-base), background var(--transition-base)",
      }}
      onMouseEnter={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = "rgba(255,100,75,.35)";
          e.currentTarget.style.background = "rgba(255,80,80,.03)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
          e.currentTarget.style.background = "rgba(255,255,255,.025)";
          e.currentTarget.style.borderStyle = "dashed";
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleChange}
      />
      <Upload
        size={20}
        strokeWidth={1.5}
        style={{ color: "var(--text-muted)" }}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        Drop your video here
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Drag and drop to get started
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          inputRef.current?.click();
        }}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-secondary)",
          border: "1px solid var(--bg-border)",
          borderRadius: 7,
          padding: "7px 18px",
          background: "var(--bg-elevated)",
          cursor: "pointer",
        }}
      >
        Browse files
      </button>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        MP4 &middot; MOV &middot; WebM &middot; up to 500 MB
      </span>
    </label>
  );
}
