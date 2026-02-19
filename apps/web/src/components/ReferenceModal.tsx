"use client";

import { useState, useEffect, useCallback } from "react";
import { parseCitation, type CitationReference } from "@part107/core";

export type ResolvedReference = CitationReference;

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

  const buildReferenceUrl = (r: ResolvedReference) => {
    if (r.type !== "pdf") return r.url;

    const fragment = new URLSearchParams();
    if (r.page && r.page > 0) {
      fragment.set("page", String(r.page));
    }
    if (r.search?.trim()) {
      fragment.set("search", r.search.trim());
    }
    const suffix = fragment.toString();
    return suffix ? `${r.url}#${suffix}` : r.url;
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
            {ref_.type === "pdf" && ref_.search?.trim() && (
              <p className="mt-1 text-[11px] text-brand-300">
                Jump target: {ref_.search}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Open in new tab */}
            <a
              href={buildReferenceUrl(ref_)}
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
          ) : ref_.url.startsWith("/") ? (
            <iframe
              src={buildReferenceUrl(ref_)}
              title={ref_.description}
              className="w-full h-full min-h-[60vh]"
              style={{ border: "none" }}
            />
          ) : (
            <div className="h-full min-h-[60vh] flex items-center justify-center p-6 bg-[var(--background)]">
              <div className="max-w-md text-center space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  This reference cannot be embedded here. Open it in a new browser tab.
                </p>
                <a
                  href={buildReferenceUrl(ref_)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-sm text-brand-300 hover:bg-brand-500/20"
                >
                  Open Reference ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clickable Citation Component ────────────────────────────────

interface CitationLinksProps {
  citation: string;
  label?: string;
  onReferenceClick?: (ref: ResolvedReference) => void;
}

export default function CitationLinks({
  citation,
  label = "📖 Reference:",
  onReferenceClick,
}: CitationLinksProps) {
  const [activeRef, setActiveRef] = useState<ResolvedReference | null>(null);
  const refs = parseCitation(citation);

  const handleClose = useCallback(() => setActiveRef(null), []);

  if (refs.length === 0) {
    // Fallback: just show the raw citation text
    return (
      <div className="mt-4 text-xs text-[var(--muted)]">
        {label} {citation}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        {refs.map((ref, i) => (
          <button
            key={`${ref.label}-${i}`}
            onClick={() => {
              onReferenceClick?.(ref);
              if (ref.type === "external" || (ref.type === "pdf" && !ref.url.startsWith("/"))) {
                const urlParams = new URLSearchParams();
                if (ref.page && ref.page > 0) {
                  urlParams.set("page", String(ref.page));
                }
                if (ref.search?.trim()) {
                  urlParams.set("search", ref.search.trim());
                }
                const suffix = ref.type === "pdf" ? urlParams.toString() : "";
                const url = suffix ? `${ref.url}#${suffix}` : ref.url;
                window.open(url, "_blank", "noopener,noreferrer");
                return;
              }
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
