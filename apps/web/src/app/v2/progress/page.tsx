"use client";

import dynamic from "next/dynamic";

const ProgressPage = dynamic(() => import("../../progress/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Progress…</div>
    </div>
  ),
});

export default function V2ProgressPage() {
  return <ProgressPage />;
}
