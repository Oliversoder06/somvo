import { Logo } from "@/components/logo";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-base">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden items-center justify-center border-r border-border">
        {/* Animated mesh gradient */}
        <div className="auth-gradient-bg" />
        <div className="auth-gradient-orb" />

        {/* Content — pushed slightly above center */}
        <div className="relative z-10 flex flex-col items-center px-12 max-w-[520px] w-full -mt-6">
          {/* Logo + wordmark + tagline */}
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="relative mb-2">
              <div className="auth-logo-glow" />
              <Image
                src="/logo/somvo-mini.svg"
                alt="Somvo"
                width={48}
                height={54}
                className="relative z-10"
                priority
              />
            </div>
            <Logo height={24} />
            <p className="text-fg-secondary text-[14px] leading-relaxed text-center">
              Edit videos with AI that{" "}
              <span className="gradient-text font-semibold">
                actually thinks.
              </span>
            </p>
          </div>

          {/* Mock editor preview — resembling real editor */}
          <div className="auth-mock-editor">
            {/* Title bar */}
            <div className="auth-mock-titlebar">
              <div className="flex items-center gap-1.5">
                <div className="w-[7px] h-[7px] rounded-full bg-[#ff5f57]" />
                <div className="w-[7px] h-[7px] rounded-full bg-[#febc2e]" />
                <div className="w-[7px] h-[7px] rounded-full bg-[#28c840]" />
              </div>
              <span className="text-fg-muted text-[10px] font-mono">
                project_final.mp4 — Somvo Editor
              </span>
              <div />
            </div>

            {/* Editor body */}
            <div className="flex h-[180px]">
              {/* Video preview area */}
              <div className="flex-1 flex items-center justify-center bg-base/60 rounded-bl">
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/[0.03]">
                  <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white/30 ml-[2px]" />
                </div>
              </div>

              {/* Right sidebar — agent panel */}
              <div className="w-[140px] border-l border-white/[0.04] p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="auth-agent-dot" />
                  <span className="text-accent text-[9px] font-mono font-medium">AI Agent</span>
                </div>
                {/* Step cards */}
                <div className="auth-step-card">
                  <div className="auth-step-icon auth-step-done">✓</div>
                  <div>
                    <div className="text-[8px] text-fg-secondary font-medium">Remove silence</div>
                    <div className="text-[7px] text-fg-muted">12 cuts found</div>
                  </div>
                </div>
                <div className="auth-step-card auth-step-active">
                  <div className="auth-step-icon auth-step-processing">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[8px] text-accent font-medium">Smart captions</div>
                    <div className="text-[7px] text-fg-muted">Analyzing…</div>
                  </div>
                </div>
                <div className="auth-step-card">
                  <div className="auth-step-icon">3</div>
                  <div>
                    <div className="text-[8px] text-fg-muted">Auto-pacing</div>
                    <div className="text-[7px] text-fg-muted/60">Queued</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="auth-mock-timeline">
              {/* Time ruler */}
              <div className="flex justify-between px-1 mb-1">
                <span className="text-[7px] text-fg-muted/50 font-mono">0:00</span>
                <span className="text-[7px] text-fg-muted/50 font-mono">0:15</span>
                <span className="text-[7px] text-fg-muted/50 font-mono">0:30</span>
                <span className="text-[7px] text-fg-muted/50 font-mono">0:45</span>
                <span className="text-[7px] text-fg-muted/50 font-mono">1:00</span>
              </div>
              {/* Waveform */}
              <div className="flex gap-[1px] h-6 items-end relative">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 20 + Math.abs(Math.sin(i * 0.7) * 55) + Math.abs(Math.cos(i * 1.2) * 20);
                  return (
                    <div
                      key={i}
                      className="auth-waveform-bar"
                      style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
                    />
                  );
                })}
                {/* Playhead */}
                <div className="auth-playhead" />
              </div>
              {/* Cut regions hint */}
              <div className="relative h-2 mt-1 rounded-sm overflow-hidden">
                <div className="absolute left-[8%] w-[6%] h-full bg-danger/20 border-l border-r border-danger/30 rounded-sm" />
                <div className="absolute left-[28%] w-[4%] h-full bg-danger/20 border-l border-r border-danger/30 rounded-sm" />
                <div className="absolute left-[52%] w-[5%] h-full bg-danger/20 border-l border-r border-danger/30 rounded-sm" />
                <div className="absolute left-[78%] w-[7%] h-full bg-danger/20 border-l border-r border-danger/30 rounded-sm" />
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <p className="text-fg-muted text-[11px] font-mono tracking-wide mt-8">
            Agent reasoning you can see.
          </p>
        </div>
      </div>

      {/* Right form panel — pushed above center */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-[400px] -mt-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-10">
            <Image
              src="/logo/somvo-mini.svg"
              alt="Somvo"
              width={40}
              height={45}
              priority
            />
            <Logo height={20} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
