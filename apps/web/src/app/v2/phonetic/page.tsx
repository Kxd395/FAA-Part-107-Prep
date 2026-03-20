"use client";

import dynamic from "next/dynamic";

const PhoneticPage = dynamic(() => import("../../phonetic/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-zinc-500 text-sm">Loading Phonetic Alphabet…</div>
    </div>
  ),
});

export default function V2PhoneticPage() {
  return <PhoneticPage />;
}
