import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  await ffmpeg.load();
  return ffmpeg;
}

export async function extractThumbnail(
  file: File,
): Promise<{ thumbnailUrl: string; durationSeconds: number }> {
  const ff = await getFFmpeg();

  const inputName = "input" + getExtension(file.type);
  await ff.writeFile(inputName, await fetchFile(file));

  // Extract thumbnail at 1 second
  await ff.exec([
    "-ss",
    "00:00:01",
    "-i",
    inputName,
    "-vframes",
    "1",
    "-q:v",
    "2",
    "thumbnail.jpg",
  ]);

  const thumbnailData = await ff.readFile("thumbnail.jpg");
  const thumbnailBlob = new Blob(
    [new Uint8Array(thumbnailData as Uint8Array)],
    {
      type: "image/jpeg",
    },
  );
  const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

  // Extract duration by running a probe-like command
  let durationSeconds = 0;
  try {
    // Use ffmpeg to get duration — write to a short clip and check logs
    let logOutput = "";
    ff.on("log", ({ message }) => {
      logOutput += message + "\n";
    });

    await ff.exec(["-i", inputName, "-f", "null", "-"]);

    const durationMatch = logOutput.match(
      /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/,
    );
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10);
      const minutes = parseInt(durationMatch[2], 10);
      const seconds = parseInt(durationMatch[3], 10);
      const centiseconds = parseInt(durationMatch[4], 10);
      durationSeconds =
        hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
  } catch {
    // Duration extraction failed — will use 0
  }

  // Cleanup
  try {
    await ff.deleteFile(inputName);
    await ff.deleteFile("thumbnail.jpg");
  } catch {
    // Ignore cleanup errors
  }

  return { thumbnailUrl, durationSeconds };
}

function getExtension(mimeType: string): string {
  if (mimeType === "video/quicktime") return ".mov";
  if (mimeType === "video/webm") return ".webm";
  return ".mp4";
}
