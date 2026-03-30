import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Somvo — AI Video Editor",
    template: "%s | Somvo",
  },
  description:
    "AI-powered video editing with visible agent reasoning, per-edit approval, and one-click export.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "Somvo — AI Video Editor",
    description:
      "AI-powered video editing with visible agent reasoning, per-edit approval, and one-click export.",
    siteName: "Somvo",
    type: "website",
  },
  icons: {
    icon: "/logo/somvo-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
