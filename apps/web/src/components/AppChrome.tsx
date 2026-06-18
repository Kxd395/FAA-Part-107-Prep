"use client";

import { usePathname } from "next/navigation";
import AppHeaderNav from "./AppHeaderNav";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isV2Route = pathname === "/v2" || pathname.startsWith("/v2/");

  if (isV2Route) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <AppHeaderNav />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-[var(--card-border)] py-6 text-center text-xs text-[var(--muted)]">
        <p>
          Based on official FAA sources (FAA-G-8082-22, FAA-CT-8080-2H).
          Updated for 2026 rules.
        </p>
        <p className="mt-1">Not affiliated with the FAA.</p>
      </footer>
    </>
  );
}
