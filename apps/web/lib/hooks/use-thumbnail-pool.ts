import { useEffect, useState } from "react";

export function useThumbnailPool(
  playerRef: React.MutableRefObject<HTMLVideoElement | null>,
  duration: number,
) {
  const [pool, setPool] = useState<{ time: number; url: string }[]>([]);

  useEffect(() => {
    const src = playerRef.current?.src;
    if (!src || duration <= 0) return;

    const count = Math.min(80, Math.max(10, Math.ceil(duration / 2)));

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.src = src;

    const thumbH = 54;
    const thumbW = Math.round(thumbH * (16 / 9));
    const canvas = document.createElement("canvas");
    canvas.width = thumbW * 2;
    canvas.height = thumbH * 2;
    const ctx = canvas.getContext("2d")!;

    const frames: { time: number; url: string }[] = [];
    let idx = 0;

    const captureFrame = () => {
      if (cancelled) return;
      const t = (idx / count) * duration;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time: t, url: canvas.toDataURL("image/jpeg", 0.5) });
      idx++;
      if (idx < count) {
        video.currentTime = (idx / count) * duration;
      } else {
        setPool([...frames]);
        video.removeAttribute("src");
        video.load();
      }
    };

    video.addEventListener("seeked", captureFrame);
    video.addEventListener("loadeddata", () => {
      if (cancelled) return;
      video.currentTime = 0;
    });

    return () => {
      cancelled = true;
      video.removeEventListener("seeked", captureFrame);
      video.removeAttribute("src");
      video.load();
    };
  }, [playerRef, duration]);

  return pool;
}
