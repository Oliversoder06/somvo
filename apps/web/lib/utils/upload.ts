import { createClient } from "@/lib/supabase/client";
import { extractThumbnail } from "@/lib/ffmpeg/thumbnail";

export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function extFromMime(mime: string) {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "mp4";
}

export async function uploadVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ projectId: string } | { error: string }> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { error: "Unsupported file type. Use MP4, MOV, or WebM." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File too large. Maximum size is 500 MB." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { error: "You must be signed in to upload." };
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
    return { error: insertErr?.message ?? "Failed to create project." };
  }

  const ext = extFromMime(file.type);
  const storagePath = `${user.id}/${project.id}/original.${ext}`;

  onProgress?.(0);

  const { error: uploadErr } = await supabase.storage
    .from("raw")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadErr) {
    await supabase.from("projects").delete().eq("id", project.id);
    return { error: uploadErr.message };
  }

  onProgress?.(100);

  const { error: updateErr } = await supabase
    .from("projects")
    .update({ raw_url: storagePath, status: "ready" as const })
    .eq("id", project.id);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // Fire-and-forget: thumbnail extraction uses FFmpeg WASM which can be very
  // slow (it decodes the whole video to probe duration). Don't block the
  // redirect on it — the project is already "ready".
  extractThumbnail(file)
    .then(async ({ thumbnailUrl, durationSeconds }) => {
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
    })
    .catch(() => {
      // Thumbnail extraction is non-critical
    });

  return { projectId: project.id };
}
