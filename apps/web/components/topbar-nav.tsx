"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
];

export function TopbarNav({
  email,
  plan,
}: {
  email: string | null;
  plan: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <header
      className="shrink-0 flex items-center justify-between px-6"
      style={{
        height: 52,
        background: "rgba(0,0,0,.3)",
        borderBottom: "1px solid var(--bg-border)",
      }}
    >
      {/* Left: Logo */}
      <Link href="/">
        <Logo height={20} />
      </Link>

      {/* Centre: Nav links */}
      <nav className="flex items-center gap-5">
        {navLinks.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                transition: "color var(--transition-base)",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Plan badge + Avatar */}
      <div className="flex items-center gap-3">
        <span
          className="badge"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid rgba(255,106,82,.15)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {plan.toUpperCase()}
        </span>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-display)",
            fontSize: 11,
            fontWeight: 600,
            transition: "background var(--transition-base)",
          }}
          title="Sign out"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
