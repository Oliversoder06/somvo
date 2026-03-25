"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MousePointer2,
  Scissors,
  Type,
  Music,
  Sparkles,
  Download,
  Settings,
} from "lucide-react";

const tools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "cut", icon: Scissors, label: "Cut" },
  { id: "captions", icon: Type, label: "Captions" },
  { id: "audio", icon: Music, label: "Audio" },
  { id: "ai", icon: Sparkles, label: "AI" },
];

const bottomTools = [
  { id: "export", icon: Download, label: "Export" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export function EditorSidebar() {
  const [activeTool, setActiveTool] = useState("select");

  return (
    <aside className="w-12 shrink-0 flex flex-col items-center py-3 gap-1">
      {/* Logo */}
      <div className="mb-3">
        <Image
          src="/logo/somvo-mini.svg"
          alt="Somvo"
          width={20}
          height={20}
          priority
        />
      </div>

      {/* Top tools */}
      <div className="flex flex-col items-center gap-1">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-md transition-colors
                ${
                  isActive
                    ? "bg-elevated text-fg"
                    : "text-fg-muted hover:text-fg-secondary hover:bg-elevated/50"
                }
              `}
              title={tool.label}
            >
              <tool.icon size={16} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom tools */}
      <div className="flex flex-col items-center gap-1">
        {bottomTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`
              flex items-center justify-center w-8 h-8 rounded-md transition-colors
              ${
                activeTool === tool.id
                  ? "bg-elevated text-fg"
                  : "text-fg-muted hover:text-fg-secondary hover:bg-elevated/50"
              }
            `}
            title={tool.label}
          >
            <tool.icon size={16} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </aside>
  );
}
