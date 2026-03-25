"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      // TODO: Wire to actual Stripe billing portal endpoint
      // POST /api/billing/portal → returns { url: string }
      // const res = await fetch("/api/billing/portal", { method: "POST" });
      // const { url } = await res.json();
      // window.location.href = url;
    } catch {
      // Billing not yet available
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-display font-medium rounded border border-border text-fg-secondary hover:text-fg hover:border-fg-muted transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <ExternalLink size={14} strokeWidth={1.5} />
      )}
      Manage billing
    </button>
  );
}
