"use client";

import { useState } from "react";
import {
  MousePointer2,
  Scissors,
  Type,
  Music,
  Volume2,
  Wand2,
  Settings,
} from "lucide-react";

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
  // { id: "text", icon: Type, label: "Captions — Coming soon", enabled: false },
  // { id: "music", icon: Music, label: "Music — Coming soon", enabled: false },
  // { id: "audio", icon: Volume2, label: "Audio — Coming soon", enabled: false },
  // {
  //   id: "effects",
  //   icon: Wand2,
  //   label: "Effects — Coming soon",
  //   enabled: false,
  // },
] as const;

export function EditorSidebar() {
  const [active, setActive] = useState<string>("select");

  return (
    <div
      className="shrink-0 flex flex-col items-center"
      style={{
        width: 48,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--bg-border)",
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      {/* Tool icons */}
      <div className="flex flex-col items-center gap-1">
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
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "none",
                background:
                  isActive && isEnabled
                    ? "rgba(255,255,255,.08)"
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
                    opacity: isActive ? 0.6 : 0.3,
                  }}
                >
                  {tool.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Settings at bottom */}
      <button
        title="Settings"
        className="sidebar-tool-btn"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
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
