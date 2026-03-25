"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extractThumbnail } from "@/lib/ffmpeg/thumbnail";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; filename: string; progress: number }
  | { phase: "processing"; filename: string; projectId: string }
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
      // --- validate ---------------------------------------------------------
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

      // get current user
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

      // --- step 3: create project row (status = uploading) ------------------
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

      // --- step 2: upload file to Supabase Storage (raw bucket) -------------
      // Note: supabase-js doesn't expose XHR progress, so we show an
      // indeterminate bar and flip to 100 when done.
      const { error: uploadErr } = await supabase.storage
        .from("raw")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadErr) {
        // clean up the project row on upload failure
        await supabase.from("projects").delete().eq("id", project.id);
        setState({ phase: "error", message: uploadErr.message });
        return;
      }

      setState({ phase: "uploading", filename: file.name, progress: 100 });

      // --- step 4: update project row → processing --------------------------
      const { error: updateErr } = await supabase
        .from("projects")
        .update({ raw_url: storagePath, status: "processing" as const })
        .eq("id", project.id);

      if (updateErr) {
        setState({ phase: "error", message: updateErr.message });
        return;
      }

      // Trigger backend processing pipeline
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        await fetch(`${apiUrl}/api/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            raw_url: storagePath,
          }),
        });
      } catch {
        // Backend trigger is non-critical — pipeline may be triggered separately
      }

      // Extract thumbnail and duration via ffmpeg.wasm
      try {
        const { thumbnailUrl, durationSeconds } = await extractThumbnail(file);

        // Upload thumbnail to Supabase Storage
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

        // Save duration to projects table
        if (durationSeconds > 0) {
          await supabase
            .from("projects")
            .update({ duration_seconds: Math.round(durationSeconds) })
            .eq("id", project.id);
        }
      } catch {
        // Thumbnail extraction is non-critical — continue to editor
      }

      // Navigate directly to the editor
      router.push(`/projects/${project.id}`);
    },
    [router],
  );

  // --- drag & drop / click handlers --------------------------------------

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
      // reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  // --- render ------------------------------------------------------------

  if (state.phase === "uploading") {
    return (
      <div className="rounded-xl border-[1.5px] border-border py-16 px-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={32}
            strokeWidth={1.5}
            className="text-accent animate-spin"
          />
          <span className="font-display text-fg font-semibold">
            Uploading {state.filename}…
          </span>
          <div className="w-48 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: state.progress === 0 ? "60%" : "100%" }}
            />
          </div>
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
        className="rounded-xl border-[1.5px] border-red-400/40 bg-red-500/5 py-16 px-8 text-center cursor-pointer"
      >
        <div className="flex flex-col items-center gap-3">
          <AlertCircle size={32} strokeWidth={1.5} className="text-red-400" />
          <span className="font-display text-fg font-semibold">
            Upload failed
          </span>
          <span className="text-fg-secondary text-[13px]">{state.message}</span>
          <span className="text-accent text-[13px] font-medium mt-1">
            Click to try again
          </span>
        </div>
      </div>
    );
  }

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
            ? "border-fg-muted bg-elevated"
            : "border-border hover:border-fg-muted hover:bg-elevated"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleChange}
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
