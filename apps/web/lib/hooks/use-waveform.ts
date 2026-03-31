import { useEffect, useRef, useState } from "react";

export function useWaveform(
  playerRef: React.MutableRefObject<HTMLVideoElement | null>,
  duration: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
): boolean {
  const wsRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = playerRef.current;
    const container = containerRef.current;
    if (!el || !container || duration <= 0 || !el.src) return;

    setLoading(true);
    let ws: ReturnType<
      Awaited<typeof import("wavesurfer.js")>["default"]["create"]
    > | null = null;

    async function initWaveSurfer() {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;

        const ctx = document.createElement("canvas").getContext("2d")!;
        const waveGrad = ctx.createLinearGradient(
          0,
          0,
          container!.clientWidth,
          0,
        );
        waveGrad.addColorStop(0, "rgba(255, 77, 109, 0.45)");
        waveGrad.addColorStop(1, "rgba(255, 140, 66, 0.45)");

        const progressGrad = ctx.createLinearGradient(
          0,
          0,
          container!.clientWidth,
          0,
        );
        progressGrad.addColorStop(0, "#ff4d6d");
        progressGrad.addColorStop(1, "#ff8c42");

        ws = WaveSurfer.create({
          container: container!,
          height: "auto",
          waveColor: waveGrad,
          progressColor: progressGrad,
          cursorWidth: 0,
          barWidth: 2,
          barGap: 1,
          barRadius: 1,
          normalize: true,
          interact: false,
          url: el!.src,
        });
        ws.on("ready", () => setLoading(false));
        wsRef.current = ws;
      } catch {
        setLoading(false);
      }
    }

    initWaveSurfer();

    return () => {
      if (ws) ws.destroy();
      wsRef.current = null;
    };
  }, [playerRef, duration, containerRef]);

  return loading;
}
