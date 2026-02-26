"use client";

import {
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { parseCitation, type CitationReference } from "@part107/core";

export type ResolvedReference = CitationReference;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ReferenceModalProps {
  ref_: ResolvedReference;
  onClose: () => void;
}

export function ReferenceModal({ ref_, onClose }: ReferenceModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const panelDragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");
  const panDragStateRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex >= 0);

      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (e.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      previousActiveElementRef.current?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const panelDrag = panelDragStateRef.current;
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        setPanelOffset({
          x: panelDrag.originX + (event.clientX - panelDrag.startX),
          y: panelDrag.originY + (event.clientY - panelDrag.startY),
        });
      }

      const panDrag = panDragStateRef.current;
      if (panDrag && panDrag.pointerId === event.pointerId) {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const dx = event.clientX - panDrag.startX;
        const dy = event.clientY - panDrag.startY;
        viewport.scrollLeft = panDrag.scrollLeft - dx;
        viewport.scrollTop = panDrag.scrollTop - dy;
        event.preventDefault();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (panelDragStateRef.current?.pointerId === event.pointerId) {
        panelDragStateRef.current = null;
      }
      if (panDragStateRef.current?.pointerId === event.pointerId) {
        panDragStateRef.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    setPanelOffset({ x: 0, y: 0 });
    setZoom(1);
    setNaturalWidth(0);
    setInteractionMode("select");
    panDragStateRef.current = null;
    setIsPanning(false);
  }, [ref_.url, ref_.type]);

  const buildIframeSrc = (r: ResolvedReference) => {
    if (r.type === "pdf") {
      if (r.page) return `${r.url}#page=${r.page}`;
      return r.url;
    }
    return r.url;
  };

  const applyFitWidth = useCallback(
    (widthOverride?: number) => {
      const viewport = viewportRef.current;
      const width = widthOverride ?? naturalWidth;
      if (!viewport || width <= 0) return;

      const target = clamp((viewport.clientWidth - 16) / width, MIN_ZOOM, MAX_ZOOM);
      setZoom(target);
      viewport.scrollLeft = 0;
    },
    [naturalWidth]
  );

  const openInTabUrl = ref_.type === "pdf" && ref_.page ? `${ref_.url}#page=${ref_.page}` : ref_.url;

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button,a,input,textarea,select")) return;

    panelDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panelOffset.x,
      originY: panelOffset.y,
    };
  };

  const handleViewerWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!event.metaKey && !event.ctrlKey) return;

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setZoom((current) => clamp(current + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  };

  const handleViewerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode !== "pan" || event.button !== 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const hasOverflow = viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight;
    if (!hasOverflow) return;

    panDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
    event.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onWheelCapture={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-1/2 z-10 w-[min(95vw,64rem)] rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl flex flex-col"
        style={{
          maxHeight: "calc(100vh - 2rem)",
          transform: `translate(calc(-50% + ${panelOffset.x}px), calc(-50% + ${panelOffset.y}px))`,
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--card-border)] cursor-move"
          onPointerDown={handleHeaderPointerDown}
        >
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold text-white truncate">{ref_.label}</h3>
            <p id={descriptionId} className="text-xs text-[var(--muted)] truncate">{ref_.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {ref_.type === "image" && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((current) => clamp(current - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                  className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  Zoom -
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((current) => clamp(current + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                  className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  Zoom +
                </button>
                <button
                  type="button"
                  onClick={() => applyFitWidth()}
                  className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  Fit Width
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionMode((mode) => (mode === "pan" ? "select" : "pan"))}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    interactionMode === "pan"
                      ? "border-brand-500/60 bg-brand-500/20 text-brand-200"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white hover:border-brand-500/50"
                  }`}
                >
                  {interactionMode === "pan" ? "Hand On" : "Hand Off"}
                </button>
              </>
            )}
            <a
              href={openInTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-brand-500/50 transition-colors"
            >
              Open in Tab ↗
            </a>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close reference modal"
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-[var(--background)]">
          {ref_.type === "image" ? (
            <div
              ref={viewportRef}
              className={`h-full min-h-[50vh] overflow-auto p-4 ${interactionMode === "pan" ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"}`}
              onWheel={handleViewerWheel}
              onPointerDown={handleViewerPointerDown}
            >
              <div className="inline-block" style={{ width: naturalWidth > 0 ? `${Math.round(naturalWidth * zoom)}px` : "auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref_.url}
                  alt={ref_.label}
                  draggable={false}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    setNaturalWidth(image.naturalWidth);
                    applyFitWidth(image.naturalWidth);
                  }}
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.style.display = "none";
                    const message = document.createElement("div");
                    message.className = "text-sm text-[var(--muted)] p-4";
                    message.textContent = "Image failed to load.";
                    target.parentElement?.appendChild(message);
                  }}
                  className="block rounded-lg max-w-none h-auto"
                  style={{ width: naturalWidth > 0 ? `${Math.round(naturalWidth * zoom)}px` : "100%" }}
                />
              </div>
            </div>
          ) : ref_.url.startsWith("/") ? (
            <div className="h-full min-h-[60vh] overflow-auto" onWheelCapture={(event) => event.stopPropagation()}>
              <iframe src={buildIframeSrc(ref_)} title={ref_.description} className="w-full h-[75vh]" style={{ border: "none" }} />
            </div>
          ) : (
            <div className="h-full min-h-[60vh] flex items-center justify-center p-6">
              <div className="max-w-md text-center space-y-3">
                <p className="text-sm text-[var(--muted)]">This reference cannot be embedded here. Open it in a new browser tab.</p>
                <a
                  href={openInTabUrl}
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
              const normalizedRef = ref;
              onReferenceClick?.(normalizedRef);

              const isEmbeddableLocalPdf =
                normalizedRef.type === "pdf" &&
                normalizedRef.url.startsWith("/") &&
                /\.pdf($|[?#])/i.test(normalizedRef.url);

              if (normalizedRef.type === "external" || (normalizedRef.type === "pdf" && !isEmbeddableLocalPdf)) {
                const url =
                  normalizedRef.type === "pdf" && normalizedRef.page
                    ? `${normalizedRef.url}#page=${normalizedRef.page}`
                    : normalizedRef.url;
                window.open(url, "_blank", "noopener,noreferrer");
                return;
              }
              setActiveRef(normalizedRef);
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

      {activeRef && <ReferenceModal ref_={activeRef} onClose={handleClose} />}
    </>
  );
}
