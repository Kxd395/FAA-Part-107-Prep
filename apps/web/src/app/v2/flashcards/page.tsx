"use client";

import dynamic from "next/dynamic";

const FlashcardsPage = dynamic(() => import("../../flashcards/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Flashcards…</div>
    </div>
  ),
});

export default function V2FlashcardsPage() {
  return <FlashcardsPage />;
}
