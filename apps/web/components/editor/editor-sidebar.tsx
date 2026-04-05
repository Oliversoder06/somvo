"use client";

import { useState } from "react";
import { MousePointer2, Scissors, Settings, Subtitles } from "lucide-react";
import { useCaptionStore } from "@/lib/store/captions";

const tools = [
  {
    id: "select",
    icon: MousePointer2,
    label: "Select",
    shortcut: "V",
    enabled: true,
  },
  {
    id: "cut",
    icon: Scissors,
    label: "Cut mode",
    shortcut: "C",
    enabled: true,
  },
] as const;

export function EditorSidebar() {
  const [active, setActive] = useState<string>("select");
  const captionPanelOpen = useCaptionStore((s) => s.panelOpen);
  const toggleCaptionPanel = useCaptionStore((s) => s.togglePanel);
  const hasCaptions = useCaptionStore((s) => s.words.length > 0);

  return (
    <div
      className="shrink-0 flex flex-col items-center"
      style={{
        width: 52,
        background: "var(--bg-surface)",
        borderRadius: 10,
        paddingTop: 14,
        paddingBottom: 14,
      }}
    >
      {/* Tool icons */}
      <div className="flex flex-col items-center gap-1.5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = active === tool.id;
          const isEnabled = tool.enabled;
          return (
            <button
              key={tool.id}
              onClick={() => isEnabled && setActive(tool.id)}
              title={tool.label}
              className="sidebar-tool-btn"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                background:
                  isActive && isEnabled
                    ? "rgba(255,255,255,.06)"
                    : "transparent",
                color: !isEnabled
                  ? "var(--text-muted)"
                  : isActive
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                cursor: isEnabled ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 120ms ease",
                position: "relative",
                opacity: isEnabled ? 1 : 0.3,
              }}
            >
              <Icon size={16} strokeWidth={1.5} />
              {"shortcut" in tool && tool.shortcut && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 3,
                    fontFamily: "var(--font-mono)",
                    fontSize: 7,
                    color: "var(--text-muted)",
                    opacity: isActive ? 0.5 : 0.25,
                  }}
                >
                  {tool.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Caption style toggle */}
      <button
        onClick={toggleCaptionPanel}
        title="Caption styles"
        className="sidebar-tool-btn"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "none",
          background: captionPanelOpen ? "rgba(255,106,82,.1)" : "transparent",
          color: captionPanelOpen
            ? "var(--accent)"
            : hasCaptions
              ? "var(--text-secondary)"
              : "var(--text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 120ms ease",
          opacity: hasCaptions ? 1 : 0.35,
          marginTop: 6,
        }}
      >
        <Subtitles size={16} strokeWidth={1.5} />
      </button>

      <div className="flex-1" />

      {/* Settings at bottom */}
      <button
        title="Settings"
        className="sidebar-tool-btn"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "none",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 120ms ease",
        }}
      >
        <Settings size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
