"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Citation → link resolution ──────────────────────────────────
// Maps FAA-H-8083-25 chapter numbers to PDF page numbers
const PHAK_CHAPTER_PAGES: Record<number, number> = {
  1: 16,
  2: 40,
  3: 72,
  4: 88,
  5: 98,
  6: 149,
  7: 161,
  8: 203,
  9: 231,
  10: 245,
  11: 257,
  12: 285,
  13: 311,
  14: 335,
  15: 376,
  16: 388,
  17: 423,
};

// Figure number → image we already have in public/figures/
const FIGURE_IMAGES: Record<string, string> = {
  "2": "", // not currently in public/figures
  "12": "", // text-only figure
  "15": "", // text-only figure
  "17": "", // text-only figure
  "20": "/figures/figure-20.png",
  "21": "/figures/figure-21.png",
  "22": "/figures/figure-22.png",
  "23": "/figures/figure-23.png",
  "26": "/figures/figure-26.png",
  "59": "/figures/figure-59.png",
};

export interface ResolvedReference {
  label: string;
  type: "pdf" | "image" | "external";
  url: string;
  description: string;
  // optional page to open inside PDF viewers that support it
  page?: number | null;
}

/**
 * Parses a citation string (which may contain multiple references
 * separated by ";") and returns an array of resolved references.
 */
export function parseCitation(citation: string): ResolvedReference[] {
  const refs: ResolvedReference[] = [];
  const parts = citation.split(";").map((s) => s.trim());

  for (const part of parts) {
    // ── FAA-H-8083-25, Ch N ──
    const phakMatch = part.match(/FAA-H-8083-25[A-Z]?,\s*Ch(?:apter)?\s*(\d+)/i);
    if (phakMatch) {
      const ch = parseInt(phakMatch[1]);
      const page = PHAK_CHAPTER_PAGES[ch] ?? 1;
      refs.push({
        label: `PHAK Ch ${ch}`,
        type: "pdf",
        url: `/pdfs/faa-h-8083-25c.pdf`,
        page,
        description: `Pilot's Handbook of Aeronautical Knowledge — Chapter ${ch}`,
      });
      continue; // don't double-match ACS below
    }

    // ── ACS UA.X.X.XX ──
    const acsMatch = part.match(/ACS\s+(UA\.\w+\.\w+\.?\w*)/i);
    if (acsMatch) {
      refs.push({
        label: `ACS ${acsMatch[1]}`,
        type: "pdf",
        url: `/pdfs/uas-acs.pdf`,
        // page left null — ACS viewer will open at top; caller may append page if needed
        page: null,
        description: `UAS Airman Certification Standards — ${acsMatch[1]}`,
      });
      continue;
    }

    // ── FAA-CT-8080-2H, Figure N ──
    const figMatch = part.match(/FAA-CT-8080-2H,?\s*Figure\s*(\d+)/i);
    if (figMatch) {
      const figNum = figMatch[1];
      const imgUrl = FIGURE_IMAGES[figNum];
      if (imgUrl) {
        refs.push({
          label: `Figure ${figNum}`,
          type: "image",
          url: imgUrl,
          description: `AKTS Supplement — Figure ${figNum}`,
        });
      }
      // don't continue — there might be an AIM ref in same segment
    }

    // ── 14 CFR §PPP.SS ──
    const cfrMatch = part.match(/14\s*CFR\s*§\s*(\d+)\.(\d+)/);
    if (cfrMatch) {
      const partNum = cfrMatch[1];
      const section = cfrMatch[2];
      refs.push({
        label: `14 CFR §${partNum}.${section}`,
        type: "external",
        url: `https://www.ecfr.gov/current/title-14/part-${partNum}/section-${partNum}.${section}`,
        description: `Electronic Code of Federal Regulations — Title 14, Part ${partNum}, §${partNum}.${section}`,
      });
      // Check if there are multiple §xxx refs (e.g. "§107.15, §107.49")
      const extraCfr = [...part.matchAll(/§\s*(\d+)\.(\d+)/g)];
      if (extraCfr.length > 1) {
        for (let i = 1; i < extraCfr.length; i++) {
          const p2 = extraCfr[i][1];
          const s2 = extraCfr[i][2];
          refs.push({
            label: `14 CFR §${p2}.${s2}`,
            type: "external",
            url: `https://www.ecfr.gov/current/title-14/part-${p2}/section-${p2}.${s2}`,
            description: `Electronic Code of Federal Regulations — Title 14, Part ${p2}, §${p2}.${s2}`,
          });
        }
      }
      continue;
    }

    // ── 14 CFR §91.137-145 (range) ──
    const cfrRangeMatch = part.match(/14\s*CFR\s*§\s*(\d+)\.(\d+)-(\d+)/);
    if (cfrRangeMatch) {
      const partNum = cfrRangeMatch[1];
      const sectionStart = cfrRangeMatch[2];
      refs.push({
        label: `14 CFR §${partNum}.${sectionStart}`,
        type: "external",
        url: `https://www.ecfr.gov/current/title-14/part-${partNum}/section-${partNum}.${sectionStart}`,
        description: `Electronic Code of Federal Regulations — Title 14, Part ${partNum}`,
      });
      continue;
    }

    // ── AIM X-X-X ──
    const aimMatch = part.match(/AIM\s+(\d+-\d+-\d+)/i);
    if (aimMatch) {
      const aimSection = aimMatch[1];
      const [chapter] = aimSection.split("-");
      refs.push({
        label: `AIM ${aimSection}`,
        type: "external",
        url: `https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap${chapter}.html`,
        description: `Aeronautical Information Manual — Section ${aimSection}`,
      });
      continue;
    }

    // ── AC 107-2 ──
    if (/AC\s*107-2/i.test(part)) {
      refs.push({
        label: "AC 107-2A",
        type: "pdf",
        url: `/pdfs/ac-107-2a.pdf`,
        description: "Advisory Circular 107-2A — Small Unmanned Aircraft Systems",
      });
      continue;
    }
  }

  return refs;
}

// ─── Modal Component ─────────────────────────────────────────────

interface ReferenceModalProps {
  ref_: ResolvedReference;
  onClose: () => void;
}

export function ReferenceModal({ ref_, onClose }: ReferenceModalProps) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent scroll on body while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Helper to build iframe src; append page fragment for PDFs when available
  const buildIframeSrc = (r: ResolvedReference) => {
    if (r.type === "pdf") {
      if (r.page) return `${r.url}#page=${r.page}`;
      return r.url;
    }
    return r.url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]">
          <div>
            <h3 className="text-sm font-semibold text-white">{ref_.label}</h3>
            <p className="text-xs text-[var(--muted)]">{ref_.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Open in new tab */}
            <a
              href={ref_.type === "pdf" && ref_.page ? `${ref_.url}#page=${ref_.page}` : ref_.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-brand-500/50 transition-colors"
            >
              Open in Tab ↗
            </a>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {ref_.type === "image" ? (
            <div className="p-4 overflow-auto h-full flex items-center justify-center bg-[var(--background)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ref_.url}
                alt={ref_.label}
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = "none";
                  const msg = document.createElement("div");
                  msg.className = "text-sm text-[var(--muted)] p-4";
                  msg.textContent = "Image failed to load.";
                  t.parentElement?.appendChild(msg);
                }}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <iframe
              src={buildIframeSrc(ref_)}
              title={ref_.description}
              className="w-full h-full min-h-[60vh]"
              style={{ border: "none" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clickable Citation Component ────────────────────────────────

interface CitationLinksProps {
  citation: string;
}

export default function CitationLinks({ citation }: CitationLinksProps) {
  const [activeRef, setActiveRef] = useState<ResolvedReference | null>(null);
  const refs = parseCitation(citation);

  const handleClose = useCallback(() => setActiveRef(null), []);

  if (refs.length === 0) {
    // Fallback: just show the raw citation text
    return (
      <div className="mt-4 text-xs text-[var(--muted)]">
        📖 Reference: {citation}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">📖 Reference:</span>
        {refs.map((ref, i) => (
          <button
            key={`${ref.label}-${i}`}
            onClick={() => {
              // Open everything in the modal when possible. External sites may
              // refuse to be embedded; in that case users can use "Open in Tab".
              setActiveRef(ref);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-brand-400 hover:bg-brand-500/20 hover:text-brand-300 transition-colors cursor-pointer"
            title={ref.description}
          >
            {ref.type === "external" && <span>↗</span>}
            {ref.type === "pdf" && <span>📄</span>}
            {ref.type === "image" && <span>🗺️</span>}
            {ref.label}
          </button>
        ))}
      </div>

      {/* PDF / Image Modal */}
      {activeRef && (
        <ReferenceModal ref_={activeRef} onClose={handleClose} />
      )}
    </>
  );
}
