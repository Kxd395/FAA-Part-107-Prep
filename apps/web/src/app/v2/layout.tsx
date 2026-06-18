"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconDashboard,
  IconStudy,
  IconExam,
  IconFlashcards,
  IconLearn,
  IconMissed,
  IconSmartReview,
  IconCharts,
  IconAcronyms,
  IconPhonetic,
  IconChevronDown,
  IconMenu,
  IconClose,
} from "./icons";

/* ------------------------------------------------------------------ */
/*  Production study shell for the current Part 107 experience         */
/* ------------------------------------------------------------------ */

const PRIMARY_NAV = [
  { href: "/v2", label: "Dashboard", icon: IconDashboard },
  { href: "/v2/study", label: "Study", icon: IconStudy },
  { href: "/v2/exam", label: "Exam Sim", icon: IconExam },
];

const PRACTICE_ITEMS = [
  { href: "/v2/flashcards", label: "Flashcards", icon: IconFlashcards, desc: "Spaced-repetition cards" },
  { href: "/v2/learn", label: "Learn Mode", icon: IconLearn, desc: "Read first, test second" },
  { href: "/v2/missed", label: "Missed Qs", icon: IconMissed, desc: "Fix your weak spots" },
  { href: "/v2/study?type=weak_spots", label: "Smart Review", icon: IconSmartReview, desc: "AI-targeted drills" },
];

const TOOLS_ITEMS = [
  { href: "/v2/charts", label: "Sectional Charts", icon: IconCharts, desc: "Hi-res FAA charts" },
  { href: "/v2/acronyms", label: "FAA Acronyms", icon: IconAcronyms, desc: "RPIC, LAANC, NOTAM…" },
  { href: "/v2/phonetic", label: "Phonetic Alphabet", icon: IconPhonetic, desc: "NATO A-Z drill" },
];

function DropdownMenu({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: typeof PRACTICE_ITEMS;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* close when clicking anywhere outside this dropdown */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        {label}
        <IconChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl py-2 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors group"
            >
              <item.icon className="h-4 w-4 text-zinc-500 group-hover:text-blue-400 transition-colors" />
              <div>
                <div className="text-sm font-medium text-zinc-200">{item.label}</div>
                <div className="text-xs text-zinc-500">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const closeAll = useCallback(() => {
    setPracticeOpen(false);
    setToolsOpen(false);
  }, []);

  /* close dropdowns + mobile drawer on route change */
  useEffect(() => {
    closeAll();
    setMobileOpen(false);
  }, [pathname, closeAll]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── V2 top-bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b14]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-8 h-16">
          {/* Brand */}
          <Link href="/v2" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
              <span className="text-sm font-black text-white">DW</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-tight text-white">
                DarkWater<span className="text-blue-400"> Drones</span>
              </span>
              <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                Part 107 Prep
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeAll}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${active ? "text-blue-400" : ""}`} />
                  {item.label}
                </Link>
              );
            })}

            <div className="h-5 w-px bg-white/10" />

            <DropdownMenu
              label="Practice"
              items={PRACTICE_ITEMS}
              open={practiceOpen}
              onToggle={() => {
                setPracticeOpen(!practiceOpen);
                setToolsOpen(false);
              }}
              onClose={closeAll}
            />
            <DropdownMenu
              label="Tools"
              items={TOOLS_ITEMS}
              open={toolsOpen}
              onToggle={() => {
                setToolsOpen(!toolsOpen);
                setPracticeOpen(false);
              }}
              onClose={closeAll}
            />
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#070b14]/95 backdrop-blur-xl px-4 pb-4 pt-2 space-y-1">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                <item.icon className="h-4 w-4 text-zinc-500" />
                {item.label}
              </Link>
            ))}
            <div className="pt-2 pb-1 px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider">Practice</div>
            {PRACTICE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
              >
                <item.icon className="h-4 w-4 text-zinc-600" />
                {item.label}
              </Link>
            ))}
            <div className="pt-2 pb-1 px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider">Tools</div>
            {TOOLS_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
              >
                <item.icon className="h-4 w-4 text-zinc-600" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Page content ───────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-zinc-600">
            © {new Date().getFullYear()} DarkWater Drones · Pembroke, NC
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>Based on FAA-G-8082-22, FAA-CT-8080-2H</span>
            <span className="text-zinc-800">·</span>
            <span>Not affiliated with the FAA</span>
          </div>
          <span className="text-xs text-zinc-500">Production study workspace</span>
        </div>
      </footer>
    </div>
  );
}
