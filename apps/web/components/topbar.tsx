import Image from "next/image";

export function Topbar() {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-surface border-b border-border">
      {/* Logo */}
      <Image
        src="/logo/somvo-logo.svg"
        alt="Somvo"
        width={100}
        height={20}
        priority
      />

      {/* Right section */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded bg-[#f5a62318] text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Free
        </span>
        <div className="w-8 h-8 rounded-md bg-elevated flex items-center justify-center text-fg-secondary text-xs font-display font-semibold">
          U
        </div>
      </div>
    </header>
  );
}
