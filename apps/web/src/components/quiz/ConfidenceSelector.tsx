import type { AttemptConfidence } from "@part107/core";

interface ConfidenceSelectorProps {
  value: AttemptConfidence;
  onChange: (value: AttemptConfidence) => void;
  className?: string;
  size?: "sm" | "md";
}

const CONFIDENCE_VALUES: AttemptConfidence[] = [1, 2, 3, 4, 5];

export default function ConfidenceSelector({
  value,
  onChange,
  className = "mt-2 flex justify-center gap-2",
  size = "sm",
}: ConfidenceSelectorProps) {
  const buttonClass =
    size === "md"
      ? "rounded-lg border px-3 py-1.5 text-sm transition-colors"
      : "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors";

  return (
    <div className={className}>
      {CONFIDENCE_VALUES.map((confidence) => (
        <button
          key={confidence}
          type="button"
          onClick={() => onChange(confidence)}
          className={`${buttonClass} ${
            value === confidence
              ? "border-brand-400 bg-brand-500/30 text-white"
              : "border-brand-400/40 bg-brand-500/10 text-brand-200 hover:bg-brand-500/20"
          }`}
        >
          {confidence}
        </button>
      ))}
    </div>
  );
}
