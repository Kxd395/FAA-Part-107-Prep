import Link from "next/link";

const FIGURES = [20, 21, 22, 23, 26, 59] as const;

export default function ChartsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🗺️ Sectional Charts</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Open FAA testing supplement figures used in study and exam questions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIGURES.map((figure) => (
          <a
            key={figure}
            href={`/figures/figure-${figure}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] transition-colors hover:border-brand-500/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/figures/figure-${figure}.png`}
              alt={`FAA Testing Supplement Figure ${figure}`}
              className="h-44 w-full object-cover"
            />
            <div className="p-3">
              <div className="text-sm font-semibold text-white">Figure {figure}</div>
              <div className="text-xs text-[var(--muted)] group-hover:text-brand-400">
                Open full resolution ↗
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
        <p>Additional FAA references:</p>
        <div className="mt-2 flex flex-wrap gap-3 text-brand-400">
          <a href="/pdfs/uas-acs.pdf" target="_blank" rel="noopener noreferrer">
            UAS ACS (PDF)
          </a>
          <a href="/pdfs/ac-107-2a.pdf" target="_blank" rel="noopener noreferrer">
            AC 107-2A (PDF)
          </a>
          <a href="/pdfs/remote-pilot-study-guide.pdf" target="_blank" rel="noopener noreferrer">
            Remote Pilot Study Guide (PDF)
          </a>
        </div>
      </div>

      <Link href="/study" className="inline-block text-sm text-brand-400 hover:text-brand-300">
        ← Back to Study Mode
      </Link>
    </div>
  );
}
