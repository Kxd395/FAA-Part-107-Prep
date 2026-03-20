"use client";

import dynamic from "next/dynamic";

const ChartsPage = dynamic(() => import("../../charts/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Charts…</div>
    </div>
  ),
});

export default function V2ChartsPage() {
  return <ChartsPage />;
}
