"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Film, AudioLines, Subtitles } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { useCaptionStore } from "@/lib/store/captions";
import { useWaveform } from "@/lib/hooks/use-waveform";
import { useThumbnailPool } from "@/lib/hooks/use-thumbnail-pool";
import { useVisibleTiles, THUMB_TILE_W } from "@/lib/hooks/use-visible-tiles";
import { formatRulerTime } from "@/lib/utils/format-time";

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
  const timelineHeight = useEditorStore((s) => s.timelineHeight);
  const setTimelineHeight = useEditorStore((s) => s.setTimelineHeight);
  const previewMode = useEditorStore((s) => s.previewMode);

  const captionChunks = useCaptionStore((s) => s.chunks);
  const captionsEnabled = useCaptionStore((s) => s.enabled);
  const hasCaptions = captionChunks.length > 0;

  const waveformRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

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

  // Drag-scrub: mousedown starts, mousemove continues, mouseup ends
  const scrubFromEvent = useCallback(
    (clientX: number, target: HTMLElement) => {
      if (duration <= 0) return;
      const rect = target.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = pct * duration;
      if (playerRef.current) playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration, playerRef, setCurrentTime],
  );

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      const target = e.currentTarget;
      scrubFromEvent(e.clientX, target);

      const handleMove = (ev: MouseEvent) => scrubFromEvent(ev.clientX, target);
      const handleUp = () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [duration, scrubFromEvent],
  );

  const renderCutRegions = () =>
    steps.map((step) => {
      if (
        duration <= 0 ||
        step.status !== "approved" ||
        !previewMode ||
        step.type === "caption"
      )
        return null;
      const left = (step.startTime / duration) * 100;
      const width = ((step.endTime - step.startTime) / duration) * 100;
      return (
        <div
          key={`region-${step.id}`}
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: previewMode
              ? "repeating-linear-gradient(-45deg, rgba(229,72,77,.45), rgba(229,72,77,.45) 4px, rgba(229,72,77,.15) 4px, rgba(229,72,77,.15) 8px)"
              : "var(--cut-region)",
            borderLeft: previewMode
              ? "2px solid rgba(229,72,77,.7)"
              : "1px solid var(--cut-border)",
            borderRight: previewMode
              ? "2px solid rgba(229,72,77,.7)"
              : "1px solid var(--cut-border)",
            opacity: 1,
            transition: "all 200ms ease",
          }}
        >
          {previewMode && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 2,
                background: "rgba(229,72,77,.8)",
                transform: "translateY(-50%)",
              }}
            />
          )}
        </div>
      );
    });

  const approvedCuts = steps.filter((s) => s.status === "approved").length;
  const zoomWidth = `${zoom * 100}%`;

  // Drag-to-resize handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startH: timelineHeight };
      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = resizeRef.current.startY - ev.clientY;
        setTimelineHeight(resizeRef.current.startH + delta);
      };
      const handleUp = () => {
        resizeRef.current = null;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [timelineHeight, setTimelineHeight],
  );

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        height: timelineHeight,
        background: "var(--bg-surface)",
        position: "relative",
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: "absolute",
          top: -2,
          left: 0,
          right: 0,
          height: 5,
          cursor: "row-resize",
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: 28,
            height: 2,
            borderRadius: 1,
            background: "rgba(255,255,255,.08)",
            margin: "1px auto 0",
            transition: "background 150ms ease",
          }}
        />
      </div>

      {/* Timecode ruler */}
      <div
        className="shrink-0 flex"
        style={{
          height: 24,
          borderBottom: "1px solid var(--panel-border-subtle)",
        }}
      >
        {/* Ruler label spacer */}
        <div className="shrink-0" style={{ width: 72 }} />
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
                  boxShadow: "0 0 4px var(--playhead-glow)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable tracks area */}
      <div className="flex-1 flex min-h-0">
        {/* Track labels (fixed) */}
        <div className="shrink-0 flex flex-col" style={{ width: 72 }}>
          <div
            className="flex-1 flex items-center justify-end gap-1.5"
            style={{
              paddingRight: 12,
              borderRight: "1px solid var(--panel-border)",
            }}
          >
            <Film
              size={10}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)", opacity: 0.6 }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-secondary)",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              Main
            </span>
          </div>
          <div
            className="flex items-center justify-end gap-1.5"
            style={{
              height: 48,
              paddingRight: 12,
              borderRight: "1px solid var(--panel-border)",
              borderTop: "1px solid var(--panel-border-subtle)",
            }}
          >
            <AudioLines
              size={10}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)", opacity: 0.6 }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-muted)",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              Audio
            </span>
          </div>
          {hasCaptions && (
            <div
              className="flex items-center justify-end gap-1.5"
              style={{
                height: 32,
                paddingRight: 12,
                borderRight: "1px solid var(--panel-border)",
                borderTop: "1px solid var(--panel-border-subtle)",
              }}
            >
              <Subtitles
                size={10}
                strokeWidth={1.5}
                style={{
                  color: captionsEnabled
                    ? "var(--accent)"
                    : "var(--text-muted)",
                  opacity: captionsEnabled ? 0.8 : 0.6,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: captionsEnabled
                    ? "var(--accent)"
                    : "var(--text-muted)",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                }}
              >
                Subs
              </span>
            </div>
          )}
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
            className="flex flex-col min-h-0 flex-1 relative"
            style={{ width: zoomWidth, minWidth: "100%" }}
          >
            {/* Playhead — spans all tracks */}
            <div
              ref={playheadRef}
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{
                left: 0,
                width: 1,
                background: "var(--playhead)",
                boxShadow: "0 0 4px var(--playhead-glow)",
                borderRadius: 0,
              }}
            >
              {/* Small handle at top */}
              <div
                style={{
                  position: "absolute",
                  top: -1,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--playhead)",
                  boxShadow: "0 0 6px var(--playhead-glow)",
                }}
              />
            </div>

            {/* Main video track */}
            <div className="flex-1 min-h-0">
              <div
                className="relative cursor-pointer h-full"
                style={{ padding: "4px 0" }}
                onMouseDown={handleTimelineMouseDown}
              >
                <div
                  className="relative h-full overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    borderRadius: 6,
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
                </div>
              </div>
            </div>

            {/* Audio / Waveform track */}
            <div
              style={{
                height: 48,
                borderTop: "1px solid var(--panel-border-subtle)",
              }}
            >
              <div
                className="relative cursor-pointer h-full"
                style={{ padding: "4px 0" }}
                onMouseDown={handleTimelineMouseDown}
              >
                <div
                  className="relative h-full overflow-hidden"
                  style={{
                    borderRadius: 6,
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

            {/* Captions / Subtitle track */}
            {hasCaptions && (
              <div
                style={{
                  height: 32,
                  borderTop: "1px solid var(--panel-border-subtle)",
                }}
              >
                <div
                  className="relative cursor-pointer h-full"
                  style={{ padding: "3px 0" }}
                  onMouseDown={handleTimelineMouseDown}
                >
                  <div
                    className="relative h-full overflow-hidden"
                    style={{
                      borderRadius: 6,
                      background: "rgba(255,255,255,.02)",
                    }}
                  >
                    {captionChunks.map((chunk) => {
                      if (duration <= 0) return null;
                      const left = (chunk.start / duration) * 100;
                      const width =
                        ((chunk.end - chunk.start) / duration) * 100;
                      return (
                        <div
                          key={chunk.id}
                          className="absolute top-0 bottom-0"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: 2,
                            background: captionsEnabled
                              ? "rgba(255,106,82,.18)"
                              : "rgba(255,255,255,.06)",
                            border: captionsEnabled
                              ? "1px solid rgba(255,106,82,.3)"
                              : "1px solid rgba(255,255,255,.08)",
                            borderRadius: 5,
                            display: "flex",
                            alignItems: "center",
                            overflow: "hidden",
                            padding: "0 4px",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 8,
                              color: captionsEnabled
                                ? "var(--accent)"
                                : "var(--text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1,
                              opacity: 0.85,
                            }}
                          >
                            {chunk.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cuts indicator */}
      {approvedCuts > 0 && (
        <div
          className="shrink-0 flex items-center justify-end"
          style={{
            height: 20,
            padding: "0 10px",
            borderTop: "1px solid var(--panel-border-subtle)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--danger)",
              opacity: 0.5,
            }}
          >
            {approvedCuts} approved cut{approvedCuts !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
