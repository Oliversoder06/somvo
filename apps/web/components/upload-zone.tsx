"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extractThumbnail } from "@/lib/ffmpeg/thumbnail";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string; progress: number }
  | { phase: "error"; message: string };

function extFromMime(mime: string) {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "mp4";
}

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

      const supabase = createClient();
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        setState({
          phase: "error",
          message: "You must be signed in to upload.",
        });
        return;
      }

      const { data: project, error: insertErr } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          filename: file.name,
          status: "uploading" as const,
        })
        .select("id")
        .single();

      if (insertErr || !project) {
        setState({
          phase: "error",
          message: insertErr?.message ?? "Failed to create project.",
        });
        return;
      }

      const ext = extFromMime(file.type);
      const storagePath = `${user.id}/${project.id}/original.${ext}`;

      setState({ phase: "uploading", filename: file.name, progress: 0 });

      const { error: uploadErr } = await supabase.storage
        .from("raw")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadErr) {
        await supabase.from("projects").delete().eq("id", project.id);
        setState({ phase: "error", message: uploadErr.message });
        return;
      }

      setState({ phase: "uploading", filename: file.name, progress: 100 });

      const { error: updateErr } = await supabase
        .from("projects")
        .update({ raw_url: storagePath, status: "ready" as const })
        .eq("id", project.id);

      if (updateErr) {
        setState({ phase: "error", message: updateErr.message });
        return;
      }

      try {
        const { thumbnailUrl, durationSeconds } = await extractThumbnail(file);
        if (thumbnailUrl) {
          const thumbResp = await fetch(thumbnailUrl);
          const thumbBlob = await thumbResp.blob();
          await supabase.storage
            .from("raw")
            .upload(`${user.id}/${project.id}/thumbnail.jpg`, thumbBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });
          URL.revokeObjectURL(thumbnailUrl);
        }
        if (durationSeconds > 0) {
          await supabase
            .from("projects")
            .update({ duration_seconds: Math.round(durationSeconds) })
            .eq("id", project.id);
        }
      } catch {
        // Thumbnail extraction is non-critical
      }

      router.push(`/projects/${project.id}`);
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
        transition: "border-color var(--transition-base), background var(--transition-base)",
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
      <Upload size={20} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
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
