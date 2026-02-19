interface ProgressHeaderProps {
  left: string;
  right?: string;
  progress: number;
  progressClassName?: string;
}

export default function ProgressHeader({
  left,
  right,
  progress,
  progressClassName = "bg-brand-500",
}: ProgressHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>{left}</span>
        {right && <span>{right}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressClassName}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  );
}
