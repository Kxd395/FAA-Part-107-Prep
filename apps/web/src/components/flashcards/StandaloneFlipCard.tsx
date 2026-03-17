"use client";

import type { ReactNode } from "react";

interface StandaloneFlipCardProps {
  front: ReactNode;
  back: ReactNode;
  revealed: boolean;
  onReveal: () => void;
  onNext: () => void;
  ariaLabel: string;
  accentClassName: string;
  className?: string;
}

export function StandaloneFlipCard({
  front,
  back,
  revealed,
  onReveal,
  onNext,
  ariaLabel,
  accentClassName,
  className = "h-72",
}: StandaloneFlipCardProps) {
  return (
    <button
      onClick={revealed ? onNext : onReveal}
      className={`flex w-full flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-6 text-center transition-all hover:border-white/20 ${className}`}
      aria-label={ariaLabel}
    >
      {!revealed ? (
        <>
          {front}
          <div className="mt-4 text-xs uppercase tracking-widest text-[var(--muted)]">
            Tap to reveal
          </div>
        </>
      ) : (
        <>
          {back}
          <div className={`mt-4 text-xs uppercase tracking-widest ${accentClassName}`}>
            Tap for next
          </div>
        </>
      )}
    </button>
  );
}
