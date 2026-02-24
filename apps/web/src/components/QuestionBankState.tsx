interface QuestionBankLoadingProps {
  label?: string;
}

interface QuestionBankErrorProps {
  error: string;
  onRetry: () => void;
}

interface QuestionBankWarningProps {
  warning: string;
  snapshotInfo?: {
    updatedAt: string;
    ageMs: number;
  } | null;
  onTryLive?: () => void;
  onClearSnapshot?: () => void;
}

export function QuestionBankLoading({ label = "Loading question bank..." }: QuestionBankLoadingProps) {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-live="polite">
      <div className="text-[var(--muted)]">{label}</div>
    </div>
  );
}

export function QuestionBankError({ error, onRetry }: QuestionBankErrorProps) {
  return (
    <div
      className="mx-auto max-w-lg space-y-4 rounded-xl border border-incorrect/30 bg-incorrect/10 p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <h1 className="text-xl font-bold text-incorrect">Couldn&apos;t load questions</h1>
      <p className="text-sm text-[var(--muted)]">{error}</p>
      <button
        onClick={onRetry}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Retry
      </button>
    </div>
  );
}

function formatSnapshotAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function QuestionBankWarning({
  warning,
  snapshotInfo,
  onTryLive,
  onClearSnapshot,
}: QuestionBankWarningProps) {
  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      role="status"
      aria-live="polite"
    >
      <div>{warning}</div>
      {snapshotInfo && (
        <div className="mt-2 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-100">
          Cached snapshot age: {formatSnapshotAge(snapshotInfo.ageMs)}
        </div>
      )}
      {onTryLive && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTryLive}
            className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
          >
            Try Live Source
          </button>
          {onClearSnapshot && (
            <button
              type="button"
              onClick={onClearSnapshot}
              className="rounded-lg border border-amber-300/30 px-3 py-1.5 text-xs font-semibold text-amber-100/90 hover:bg-amber-500/10"
            >
              Clear Cached Snapshot
            </button>
          )}
        </div>
      )}
    </div>
  );
}
