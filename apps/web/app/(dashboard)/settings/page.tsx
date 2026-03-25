import { createClient } from "@/lib/supabase/server";
import { User, Mail, CreditCard, Shield, ExternalLink } from "lucide-react";
import { BillingPortalButton } from "./billing-portal-button";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan = "free";
  let createdAt = "";
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("plan, created_at")
      .eq("id", user.id)
      .single();
    if (data) {
      plan = (data as { plan: string; created_at: string }).plan;
      createdAt = (data as { plan: string; created_at: string }).created_at;
    }
  }

  return (
    <div className="fade-up">
      <h1 className="font-display text-[2.25rem] font-bold leading-[1.2] tracking-[-0.03em] mb-8">
        Settings
      </h1>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="card">
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-5 flex items-center gap-2">
            <User size={14} strokeWidth={1.5} />
            Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="font-display text-[12px] uppercase tracking-[0.06em] text-fg-secondary block mb-1.5">
                Email
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-elevated border border-border text-fg text-[14px]">
                <Mail size={14} strokeWidth={1.5} className="text-fg-muted" />
                {user?.email ?? "—"}
              </div>
            </div>
            {createdAt && (
              <div>
                <label className="font-display text-[12px] uppercase tracking-[0.06em] text-fg-secondary block mb-1.5">
                  Member since
                </label>
                <p className="font-mono text-[13px] text-fg-secondary">
                  {new Date(createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className="card">
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-5 flex items-center gap-2">
            <CreditCard size={14} strokeWidth={1.5} />
            Plan & Billing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-fg text-[1.125rem] font-semibold">
                {PLAN_LABELS[plan] ?? "Free"} Plan
              </p>
              <p className="text-fg-secondary text-[13px] mt-1">
                {plan === "free"
                  ? "Watermarked exports, 720p max, limited minutes."
                  : plan === "creator"
                    ? "Clean exports, 1080p, increased minutes."
                    : "Unlimited exports, 1080p/60fps, priority processing."}
              </p>
            </div>
            <span
              className={`badge ${plan === "free" ? "badge-uploading" : plan === "creator" ? "badge-ready" : "badge-processing"}`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "currentColor" }}
              />
              {PLAN_LABELS[plan] ?? "Free"}
            </span>
          </div>
          {plan === "free" ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-fg-muted text-[13px]">
                Upgrade to remove watermarks and unlock higher quality exports.
              </p>
              <BillingPortalButton />
            </div>
          ) : (
            <div className="mt-4">
              <BillingPortalButton />
            </div>
          )}
        </div>

        {/* Security */}
        <div className="card">
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-fg-secondary mb-5 flex items-center gap-2">
            <Shield size={14} strokeWidth={1.5} />
            Security
          </h2>
          <p className="text-fg-secondary text-[13px]">
            Authentication is managed by Supabase Auth. To change your password
            or manage your login methods, use the options provided by your auth
            provider.
          </p>
        </div>
      </div>
    </div>
  );
}
