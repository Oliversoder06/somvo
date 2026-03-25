"use client";

import { useState } from "react";
import Image from "next/image";
import {
  FileText,
  Music,
  Film,
  Crop,
  Type,
  Sparkles,
  Link2,
  SquareAsterisk,
  Settings,
  Search,
  Plus,
  FolderOpen,
} from "lucide-react";

const tabs = [
  { id: "media", icon: FileText, label: "Media" },
  { id: "audio", icon: Music, label: "Audio" },
  { id: "clips", icon: Film, label: "Clips" },
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "text", icon: Type, label: "Text" },
  { id: "effects", icon: Sparkles, label: "Effects" },
  { id: "elements", icon: Link2, label: "Elements" },
  { id: "ai", icon: SquareAsterisk, label: "AI" },
];

const bottomTabs = [{ id: "settings", icon: Settings, label: "Settings" }];

export function EditorSidebar() {
  const [activeTab, setActiveTab] = useState("media");

  return (
    <div className="flex h-full shrink-0">
      {/* Icon strip */}
      <aside className="w-12 shrink-0 flex flex-col items-center py-3 gap-0.5 border-r border-border">
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

        {/* Tab icons */}
        <div className="flex flex-col items-center gap-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(isActive ? "" : tab.id)}
                className={`
                  flex items-center justify-center w-8 h-8 rounded-md transition-colors
                  ${
                    isActive
                      ? "bg-elevated text-fg"
                      : "text-fg-muted hover:text-fg-secondary hover:bg-elevated/50"
                  }
                `}
                title={tab.label}
              >
                <tab.icon size={16} strokeWidth={1.5} />
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-0.5">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(activeTab === tab.id ? "" : tab.id)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-md transition-colors
                ${
                  activeTab === tab.id
                    ? "bg-elevated text-fg"
                    : "text-fg-muted hover:text-fg-secondary hover:bg-elevated/50"
                }
              `}
              title={tab.label}
            >
              <tab.icon size={16} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </aside>

      {/* Expandable panel */}
      {activeTab && (
        <div className="w-[220px] bg-surface border-r border-border flex flex-col overflow-hidden">
          <SidebarPanel activeTab={activeTab} />
        </div>
      )}
    </div>
  );
}

function SidebarPanel({ activeTab }: { activeTab: string }) {
  if (activeTab === "media") return <MediaLibraryPanel />;

  const tabLabels: Record<string, string> = {
    audio: "Audio",
    clips: "Video Clips",
    crop: "Crop & Resize",
    text: "Text & Titles",
    effects: "Effects",
    elements: "Elements",
    ai: "AI Tools",
    settings: "Settings",
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <p className="font-mono text-[11px] text-fg-muted text-center">
        {tabLabels[activeTab] ?? activeTab}
        <br />
        <span className="text-[10px]">Coming soon</span>
      </p>
    </div>
  );
}

function MediaLibraryPanel() {
  return (
    <>
      {/* Header */}
      <div className="px-3 py-3 flex items-start justify-between">
        <div>
          <h2 className="font-display text-[13px] font-semibold text-fg">
            Media Library
          </h2>
          <p className="font-mono text-[10px] text-fg-muted mt-0.5">
            Uploads &amp; Assets
          </p>
        </div>
        <button className="w-7 h-7 flex items-center justify-center rounded-md text-fg-muted hover:text-fg-secondary hover:bg-elevated transition-colors">
          <FolderOpen size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search + Add */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-elevated border border-border">
          <Search
            size={12}
            strokeWidth={1.5}
            className="text-fg-muted shrink-0"
          />
          <input
            type="text"
            placeholder="Search assets..."
            className="bg-transparent text-[11px] text-fg placeholder:text-fg-muted outline-none w-full font-mono"
          />
        </div>
        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-elevated border border-border text-fg-secondary hover:text-fg hover:border-fg-muted transition-colors shrink-0">
          <Plus size={12} strokeWidth={1.5} />
          <span className="font-display text-[11px] font-medium">Add</span>
        </button>
      </div>

      {/* Asset grid — placeholder thumbnails */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video rounded-md bg-elevated border border-border"
            />
          ))}
        </div>
      </div>
    </>
  );
}
