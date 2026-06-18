import type { Metadata, Viewport } from "next";
import AppChrome from "../components/AppChrome";
import "./globals.css";

import { AuthProvider } from "../components/AuthProvider";

export const metadata: Metadata = {
  title: "Part 107 Drone Exam Prep 2026",
  description:
    "Free FAA Part 107 Remote Pilot exam prep with instant feedback, AI explanations, and high-res sectional charts. Updated for 2026 rules including Remote ID and Operations Over People.",
  keywords: [
    "Part 107",
    "drone exam",
    "FAA",
    "remote pilot",
    "UAS",
    "exam prep",
    "study guide",
    "2026",
  ],
  authors: [{ name: "Part 107 Prep" }],
  openGraph: {
    title: "Part 107 Drone Exam Prep 2026",
    description: "Free FAA Part 107 exam prep — updated for 2026 rules",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
