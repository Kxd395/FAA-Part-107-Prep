"use client";

import dynamic from "next/dynamic";

const AcronymsPage = dynamic(() => import("../../acronyms/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Acronyms…</div>
    </div>
  ),
});

export default function V2AcronymsPage() {
  return <AcronymsPage />;
}
