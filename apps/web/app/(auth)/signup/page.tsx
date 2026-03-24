"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setConfirmSent(true);
    setLoading(false);
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

  if (confirmSent) {
    return (
      <div className="fade-up text-center">
        <h1 className="font-display text-2xl font-bold mb-2">
          Check your email
        </h1>
        <p className="text-fg-secondary text-[13px]">
          We sent a confirmation link to{" "}
          <span className="text-fg font-medium">{email}</span>.
          <br />
          Click the link to activate your account.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-accent text-[13px] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-bold text-center mb-1">
        Create your account
      </h1>
      <p className="text-fg-secondary text-[13px] text-center mb-8">
        Start editing videos with AI
      </p>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
            minLength={6}
            className="h-10 px-3 rounded-lg bg-elevated border border-border text-fg text-sm outline-none focus:border-accent transition-colors"
            placeholder="At least 6 characters"
          />
        </div>

        {error && <p className="text-danger text-[13px]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-lg bg-accent text-base font-display font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
