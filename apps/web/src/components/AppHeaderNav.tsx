"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActiveUserId } from "../hooks/useActiveUserId";
import { useLearningEventLogger } from "../hooks/useLearningEventLogger";
import { type LearningEventMode } from "../lib/analyticsTaxonomy";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { href: "/study", label: "Study" },
  { href: "/exam", label: "Exam" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/learn", label: "Learn" },
  { href: "/missed", label: "Missed" },
  { href: "/progress", label: "Progress" },
  { href: "/charts", label: "Charts" },
] as const;

function modeFromPathname(pathname: string | null): LearningEventMode {
  if (!pathname || pathname === "/") return "home";
  if (pathname.startsWith("/study")) return "study";
  if (pathname.startsWith("/exam")) return "exam";
  if (pathname.startsWith("/flashcards")) return "flashcards";
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/missed")) return "missed";
  if (pathname.startsWith("/progress")) return "progress";
  if (pathname.startsWith("/charts")) return "charts";
  return "home";
}

export default function AppHeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeUserId = useActiveUserId();
  const { logEvent } = useLearningEventLogger(activeUserId);
  const currentMode = modeFromPathname(pathname);

  const { user, signOut, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const logHeaderNavigation = (href: string) => {
    const target = href === "/" ? "home" : href.replace("/", "");
    logEvent({
      type: "link_opened",
      mode: currentMode,
      metadata: {
        target: `header_nav_${target}`,
        href,
        sourcePath: pathname ?? "/",
      },
    });
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push("/login");
  };

  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <Link href="/" onClick={() => logHeaderNavigation("/")} className="flex items-center gap-2">
        <span className="text-2xl">🛩️</span>
        <span className="text-lg font-bold tracking-tight">
          Part 107 <span className="text-brand-500">Prep</span>
        </span>
      </Link>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => logHeaderNavigation(item.href)}
              className="hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="h-6 w-px bg-[var(--card-border)] hidden md:block"></div>

        <div className="relative" ref={menuRef}>
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-[var(--card-border)] animate-pulse" />
          ) : user ? (
            <>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-500/20 text-brand-300 font-bold hover:bg-brand-500/30 transition-colors"
              >
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() ?? "?"}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-[var(--card-border)] mb-1">
                    <div className="text-sm font-medium truncate">{user.displayName || "Pilot"}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{user.email || user.userId}</div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => { setMenuOpen(false); logHeaderNavigation("/profile"); }}
                    className="block px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => logHeaderNavigation("/login")}
              className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
