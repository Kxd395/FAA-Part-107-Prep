interface SessionSummaryCardProps {
  passed: boolean;
  percentage: number;
  correct: number;
  total: number;
  subtitle?: string;
}

export default function SessionSummaryCard({
  passed,
  percentage,
  correct,
  total,
  subtitle,
}: SessionSummaryCardProps) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
      <div className={`text-5xl font-bold ${passed ? "text-correct" : "text-incorrect"}`}>
        {percentage}%
      </div>
      <div className="mt-2 text-[var(--muted)]">
        {correct} of {total} correct
      </div>
      {subtitle && <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div>}
    </div>
  );
}
