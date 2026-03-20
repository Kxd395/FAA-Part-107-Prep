"use client";

import dynamic from "next/dynamic";

const MissedPage = dynamic(() => import("../../missed/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Missed Questions…</div>
    </div>
  ),
});

export default function V2MissedPage() {
  return <MissedPage />;
}
