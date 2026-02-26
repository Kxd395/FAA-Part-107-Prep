import type { AttemptConfidence } from "@part107/core";

interface ConfidenceSelectorProps {
  value: AttemptConfidence;
  onChange: (value: AttemptConfidence) => void;
  className?: string;
  size?: "sm" | "md";
  mode?: "five" | "triad";
}

const FULL_CONFIDENCE_OPTIONS: Array<{ value: AttemptConfidence; label: string }> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const TRIAD_CONFIDENCE_OPTIONS: Array<{ value: AttemptConfidence; label: string }> = [
  { value: 1, label: "Not Sure" },
  { value: 3, label: "Neutral" },
  { value: 5, label: "Confident" },
];

export default function ConfidenceSelector({
  value,
  onChange,
  className = "mt-2 flex justify-center gap-2",
  size = "sm",
  mode = "five",
}: ConfidenceSelectorProps) {
  const buttonClass =
    size === "md"
      ? "rounded-lg border px-3 py-1.5 text-sm transition-colors"
      : "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors";
  const options = mode === "triad" ? TRIAD_CONFIDENCE_OPTIONS : FULL_CONFIDENCE_OPTIONS;

  return (
    <div className={className}>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.value)}
          className={`${buttonClass} ${
            value === option.value
              ? "border-brand-400 bg-brand-500/30 text-white"
              : "border-brand-400/40 bg-brand-500/10 text-brand-200 hover:bg-brand-500/20"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
