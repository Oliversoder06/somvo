"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useEditorStore } from "@/lib/store/editor";

function WaveformSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 skeleton-shimmer" />
      <div className="absolute inset-0 flex items-center gap-px px-0.5">
        {Array.from({ length: 200 }).map((_, i) => {
          const h =
            15 +
            Math.abs(Math.sin(i * 0.8) * 40) +
            Math.abs(Math.cos(i * 1.3) * 20);
          return (
            <div
              key={i}
              className="flex-1 min-w-0 rounded-full"
              style={{
                height: `${h}%`,
                background: "var(--waveform)",
                opacity: 0.6 + Math.abs(Math.sin(i * 0.5)) * 0.4,
              }}
            />
          );
        })}
      </div>
      <div className="absolute top-0 bottom-0 w-16 skeleton-scan" />
    </div>
  );
}

function useWaveform(
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
        ws = WaveSurfer.create({
          container: container!,
          height: "auto",
          waveColor: "var(--waveform)",
          progressColor: "var(--waveform-act)",
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

/**
 * Captures a pool of thumbnail frames from the video, once.
 * Returns an array of { time, dataUrl } sorted by time.
 */
function useThumbnailPool(
  playerRef: React.MutableRefObject<HTMLVideoElement | null>,
  duration: number,
) {
  const [pool, setPool] = useState<{ time: number; url: string }[]>([]);

  useEffect(() => {
    const src = playerRef.current?.src;
    if (!src || duration <= 0) return;

    // Capture one frame per ~2 seconds, capped at 80
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

/** Fixed-width thumbnail tile size */
const THUMB_TILE_W = 96;

/**
 * Given the pool of captured frames, the zoom, viewport width, scroll position
 * and duration, compute which fixed-width tiles to render and which pool frame
 * each tile should show. Only tiles visible in the viewport are returned.
 */
function useVisibleTiles(
  pool: { time: number; url: string }[],
  duration: number,
  zoom: number,
  scrollLeft: number,
  viewportWidth: number,
) {
  return useMemo(() => {
    if (pool.length === 0 || duration <= 0 || viewportWidth <= 0) return [];

    const totalWidth = viewportWidth * zoom;
    const totalTiles = Math.ceil(totalWidth / THUMB_TILE_W);
    const secPerTile = duration / totalTiles;

    // Only render tiles visible in the scroll viewport (+ 1 tile buffer each side)
    const firstVisible = Math.max(0, Math.floor(scrollLeft / THUMB_TILE_W) - 1);
    const lastVisible = Math.min(
      totalTiles - 1,
      Math.ceil((scrollLeft + viewportWidth) / THUMB_TILE_W) + 1,
    );

    const tiles: { index: number; left: number; url: string }[] = [];
    for (let i = firstVisible; i <= lastVisible; i++) {
      const tileTime = (i + 0.5) * secPerTile; // midpoint time of this tile
      // Find nearest pool frame
      let best = pool[0];
      let bestDist = Math.abs(pool[0].time - tileTime);
      for (let j = 1; j < pool.length; j++) {
        const d = Math.abs(pool[j].time - tileTime);
        if (d < bestDist) {
          best = pool[j];
          bestDist = d;
        }
      }
      tiles.push({ index: i, left: i * THUMB_TILE_W, url: best.url });
    }
    return tiles;
  }, [pool, duration, zoom, scrollLeft, viewportWidth]);
}

function formatRulerTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timeline({
  playerRef,
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const steps = useEditorStore((s) => s.steps);
  const duration = useEditorStore((s) => s.duration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setZoom = useEditorStore((s) => s.setTimelineZoom);

  const waveformRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);

  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  const waveformLoading = useWaveform(playerRef, duration, waveformRef);
  const thumbPool = useThumbnailPool(playerRef, duration);
  const visibleTiles = useVisibleTiles(
    thumbPool,
    duration,
    zoom,
    scrollLeft,
    viewportWidth,
  );

  // Measure the scroll container viewport width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Timecode ruler marks - adapt density to zoom
  const rulerMarks = useMemo(() => {
    if (duration <= 0) return [];
    // At higher zoom, show finer intervals
    const baseInterval =
      duration <= 30 ? 5 : duration <= 120 ? 15 : duration <= 300 ? 30 : 60;
    const interval = Math.max(1, Math.round(baseInterval / zoom));
    const marks: { time: number; pct: number }[] = [];
    for (let t = 0; t <= duration; t += interval) {
      marks.push({ time: t, pct: (t / duration) * 100 });
    }
    return marks;
  }, [duration, zoom]);

  // Smooth playhead via rAF + auto-scroll
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const el = playerRef.current;
      if (el && duration > 0) {
        const pct = `${(el.currentTime / duration) * 100}%`;
        if (playheadRef.current) playheadRef.current.style.left = pct;
        if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.left = pct;

        // Auto-scroll to keep playhead visible during playback
        if (el.paused === false && scrollRef.current) {
          const container = scrollRef.current;
          const scrollWidth = container.scrollWidth;
          const clientWidth = container.clientWidth;
          const playheadX = (el.currentTime / duration) * scrollWidth;
          const viewLeft = container.scrollLeft;
          const viewRight = viewLeft + clientWidth;
          // If playhead is near edge or past the visible area, center it
          if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
            container.scrollLeft = playheadX - clientWidth / 2;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playerRef, duration]);

  // Sync ruler scroll with tracks scroll + track scrollLeft for virtualization
  const handleTracksScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollLeft(scrollRef.current.scrollLeft);
      if (rulerScrollRef.current) {
        rulerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      }
    }
  }, []);

  // Ctrl+wheel = zoom, plain wheel = horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        const newZoom = Math.max(1, Math.min(20, zoom + delta));
        // Zoom towards the cursor position
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollFraction = (el.scrollLeft + mouseX) / el.scrollWidth;
        setZoom(newZoom);
        // After React re-renders with new zoom, adjust scroll
        requestAnimationFrame(() => {
          el.scrollLeft = scrollFraction * el.scrollWidth - mouseX;
        });
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // Convert vertical scroll to horizontal
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoom, setZoom]);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, pct * duration));
      if (playerRef.current) playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration, playerRef, setCurrentTime],
  );

  const renderCutRegions = () =>
    steps.map((step) => {
      if (duration <= 0 || step.status !== "approved") return null;
      const left = (step.startTime / duration) * 100;
      const width = ((step.endTime - step.startTime) / duration) * 100;
      return (
        <div
          key={`region-${step.id}`}
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: "var(--cut-region)",
            borderLeft: "1px solid var(--cut-border)",
            borderRight: "1px solid var(--cut-border)",
          }}
        />
      );
    });

  const approvedCuts = steps.filter((s) => s.status === "approved").length;
  const zoomWidth = `${zoom * 100}%`;

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        height: 160,
        background: "var(--timeline-bg)",
        borderTop: "1px solid var(--bg-border)",
      }}
    >
      {/* Timecode ruler */}
      <div
        className="shrink-0 flex"
        style={{ height: 24, borderBottom: "1px solid var(--bg-border)" }}
      >
        {/* Ruler label spacer */}
        <div className="shrink-0" style={{ width: 60 }} />
        {/* Scrollable ruler */}
        <div
          ref={rulerScrollRef}
          className="flex-1 overflow-hidden relative"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="relative h-full cursor-pointer"
            style={{
              width: zoomWidth,
              minWidth: "100%",
              pointerEvents: "auto",
            }}
            onClick={handleTimelineClick}
          >
            {rulerMarks.map((mark) => (
              <div
                key={mark.time}
                className="absolute"
                style={{
                  left: `${mark.pct}%`,
                  top: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 1,
                    height: 8,
                    background: "var(--bg-border)",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--text-muted)",
                    marginTop: 1,
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRulerTime(mark.time)}
                </span>
              </div>
            ))}
            {/* Ruler playhead indicator */}
            <div
              ref={rulerPlayheadRef}
              className="absolute z-20 pointer-events-none"
              style={{ left: 0, top: 0, bottom: 0, width: 0 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: "var(--playhead)",
                  transform: "translateX(-50%) rotate(45deg)",
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable tracks area */}
      <div className="flex-1 flex min-h-0">
        {/* Track labels (fixed) */}
        <div className="shrink-0 flex flex-col" style={{ width: 60 }}>
          <div
            className="flex-1 flex items-center justify-end"
            style={{
              paddingRight: 10,
              borderRight: "1px solid var(--bg-border)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Main
            </span>
          </div>
          <div
            className="flex items-center justify-end"
            style={{
              height: 48,
              paddingRight: 10,
              borderRight: "1px solid var(--bg-border)",
              borderTop: "1px solid var(--bg-border)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Audio
            </span>
          </div>
        </div>

        {/* Scrollable tracks content */}
        <div
          ref={scrollRef}
          className="flex-1 flex flex-col min-h-0 overflow-x-auto overflow-y-hidden"
          onScroll={handleTracksScroll}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,.1) transparent",
          }}
        >
          {/* Inner zoom container */}
          <div
            className="flex flex-col min-h-0 flex-1"
            style={{ width: zoomWidth, minWidth: "100%" }}
          >
            {/* Main video track */}
            <div className="flex-1 min-h-0">
              <div
                className="relative cursor-pointer h-full"
                style={{ padding: "4px 0" }}
                onClick={handleTimelineClick}
              >
                <div
                  className="relative h-full overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,.04)",
                  }}
                >
                  {/* Fixed-width thumbnail tiles */}
                  {visibleTiles.map((tile) => (
                    <img
                      key={tile.index}
                      src={tile.url}
                      alt=""
                      draggable={false}
                      style={{
                        position: "absolute",
                        left: tile.left,
                        top: 0,
                        width: THUMB_TILE_W,
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        pointerEvents: "none",
                        opacity: 0.85,
                        borderRight: "1px solid rgba(0,0,0,.3)",
                      }}
                    />
                  ))}
                  {renderCutRegions()}
                  {/* Playhead */}
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 z-20 pointer-events-none"
                    style={{
                      left: 0,
                      width: 2,
                      background: "var(--playhead)",
                      boxShadow: "0 0 6px var(--playhead)",
                      borderRadius: 1,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Audio / Waveform track */}
            <div
              style={{
                height: 48,
                borderTop: "1px solid var(--bg-border)",
              }}
            >
              <div
                className="relative cursor-pointer h-full"
                style={{ padding: "4px 0" }}
                onClick={handleTimelineClick}
              >
                <div
                  className="relative h-full overflow-hidden"
                  style={{
                    borderRadius: 4,
                    background: "rgba(255,255,255,.02)",
                  }}
                >
                  {waveformLoading && <WaveformSkeleton />}
                  <div
                    ref={waveformRef}
                    className="absolute inset-0 overflow-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cuts indicator */}
      {approvedCuts > 0 && (
        <div
          className="shrink-0 flex items-center justify-end"
          style={{
            height: 20,
            padding: "0 8px",
            borderTop: "1px solid var(--bg-border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--danger)",
              opacity: 0.6,
            }}
          >
            {approvedCuts} approved cut{approvedCuts !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
