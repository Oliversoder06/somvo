"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { handleOAuth } from "@/lib/utils/auth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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

  return (
    <div className="flex flex-col gap-3 auth-stagger">
      {/* Title + desc */}
      <div className="auth-stagger-item">
        <h1 className="font-display text-[34px] font-bold tracking-tight leading-[1.1]">
          Welcome back.
        </h1>
        <p className="text-fg-muted text-[14px] mt-2">
          Jump back into your projects.
        </p>
      </div>

      {/* OAuth buttons */}
      <div
        className="flex flex-col gap-3 auth-stagger-item"
        style={{ animationDelay: "60ms" }}
      >
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="auth-oauth-btn"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("github")}
          className="auth-oauth-btn"
        >
          <GitHubIcon />
          <span>Continue with GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div
        className="flex items-center gap-3 auth-stagger-item"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex-1 h-px bg-border" />
        <span className="text-fg-muted text-[11px] uppercase tracking-widest font-mono">
          or
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form inputs */}
      <form
        onSubmit={handleLogin}
        className="flex flex-col gap-5 auth-stagger-item"
        style={{ animationDelay: "180ms" }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[13px] font-medium text-fg-secondary"
          >
            Email
          </label>
          <div className="auth-input-wrap">
            <svg
              className="auth-input-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
              <path d="M2 5l6 4 6-4" />
            </svg>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input auth-input-with-icon"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-[13px] font-medium text-fg-secondary"
          >
            Password
          </label>
          <div className="auth-input-wrap">
            <svg
              className="auth-input-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5 7V5a3 3 0 016 0v2" />
            </svg>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input auth-input-with-icon"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger text-[13px] bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            </svg>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-submit-btn">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="28"
                  strokeDashoffset="8"
                  strokeLinecap="round"
                />
              </svg>
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Footer link */}
      <p
        className="text-fg-muted text-[13px] text-center auth-stagger-item"
        style={{ animationDelay: "240ms" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-accent font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
