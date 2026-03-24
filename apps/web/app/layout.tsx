import type { Metadata } from "next";
import { Syne, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
    <html
      lang="en"
      className={`${syne.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
