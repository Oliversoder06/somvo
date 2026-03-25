"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "github") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-bold text-center mb-1">
        Welcome back
      </h1>
      <p className="text-fg-secondary text-[13px] text-center mb-8">
        Sign in to your Somvo account
      </p>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[13px] font-medium text-fg-secondary"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 px-3 rounded-lg bg-elevated border border-border text-fg text-sm outline-none focus:border-accent transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-[13px] font-medium text-fg-secondary"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-10 px-3 rounded-lg bg-elevated border border-border text-fg text-sm outline-none focus:border-accent transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-danger text-[13px]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-lg bg-fg text-base font-display font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-fg-muted text-[11px] uppercase tracking-widest">
          or
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleOAuth("google")}
          className="h-10 rounded-lg border border-border bg-surface text-fg text-sm font-medium hover:bg-elevated transition-colors"
        >
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth("github")}
          className="h-10 rounded-lg border border-border bg-surface text-fg text-sm font-medium hover:bg-elevated transition-colors"
        >
          Continue with GitHub
        </button>
      </div>

      <p className="text-fg-secondary text-[13px] text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
