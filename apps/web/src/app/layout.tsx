import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

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
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🛩️</span>
              <span className="text-lg font-bold tracking-tight">
                Part 107 <span className="text-brand-500">Prep</span>
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
              <Link href="/study" className="hover:text-white transition-colors">
                Study
              </Link>
              <Link href="/exam" className="hover:text-white transition-colors">
                Exam
              </Link>
              <Link href="/progress" className="hover:text-white transition-colors">
                Progress
              </Link>
              <Link href="/charts" className="hover:text-white transition-colors">
                Charts
              </Link>
            </div>
          </nav>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-[var(--card-border)] py-6 text-center text-xs text-[var(--muted)]">
          <p>
            Based on official FAA sources (FAA-G-8082-22, FAA-CT-8080-2H).
            Updated for 2026 rules.
          </p>
          <p className="mt-1">Not affiliated with the FAA.</p>
        </footer>
      </body>
    </html>
  );
}
