import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "peaks.js": "peaks.js/src/main.js",
    },
  },
  async headers() {
    return [
      {
        // Only enable cross-origin isolation on pages that use ffmpeg.wasm
        // (SharedArrayBuffer requires COOP + COEP). Applying these globally
        // blocks cross-origin media like Supabase Storage signed URLs.
        source: "/",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
