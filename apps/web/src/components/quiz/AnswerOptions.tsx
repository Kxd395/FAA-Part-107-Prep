import type { OptionId, QuestionOption } from "@part107/core";

type AnswerState = "unanswered" | "correct" | "incorrect";

interface AnswerOptionsProps {
  options: QuestionOption[];
  mode: "study" | "exam";
  selectedOption: OptionId | null;
  correctOptionId?: OptionId;
  displayLabelByOptionId?: Partial<Record<OptionId, OptionId>>;
  answerState?: AnswerState;
  onSelect: (optionId: OptionId) => void;
  onSelectWithConfidence?: (optionId: OptionId, confidence: 1 | 2 | 3 | 4 | 5) => void;
  showConfidenceSplit?: boolean;
  splitConfidenceMode?: "full" | "high_only";
  defaultConfidence?: 1 | 2 | 3 | 4 | 5;
  confidentConfidence?: 1 | 2 | 3 | 4 | 5;
  disabled?: boolean;
}

export default function AnswerOptions({
  options,
  mode,
  selectedOption,
  correctOptionId,
  displayLabelByOptionId,
  answerState = "unanswered",
  onSelect,
  onSelectWithConfidence,
  showConfidenceSplit = false,
  splitConfidenceMode = "full",
  defaultConfidence = 3,
  confidentConfidence = 5,
  disabled = false,
}: AnswerOptionsProps) {
  const quickConfidenceActions: Array<{
    value: 1 | 2 | 3 | 4 | 5;
    label: string;
    shortLabel: string;
  }> = [
    { value: 1, label: "Not Sure", shortLabel: "NS" },
    { value: 3, label: "Neutral", shortLabel: "N" },
    { value: 5, label: "Confident", shortLabel: "C" },
  ];

  const handleSelect = (
    optionId: OptionId,
    confidence: 1 | 2 | 3 | 4 | 5 | undefined,
    source: "main" | "split"
  ) => {
    if (disabled) return;
    if (
      onSelectWithConfidence &&
      (splitConfidenceMode === "full" || source === "split")
    ) {
      onSelectWithConfidence(optionId, confidence ?? defaultConfidence);
      return;
    }
    onSelect(optionId);
  };

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = selectedOption === option.id;
        const isCorrect = correctOptionId === option.id;
        const displayLabel = displayLabelByOptionId?.[option.id] ?? option.id;
        const showFeedback = mode === "study" && answerState !== "unanswered";

        const className =
          mode === "exam"
            ? `w-full rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
              }`
            : `answer-option w-full rounded-xl border p-4 text-left transition-all cursor-pointer ${
                answerState === "unanswered"
                  ? isSelected
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/50 hover:bg-brand-500/5"
                  : isCorrect
                    ? "border-correct bg-correct/10 flash-correct"
                    : isSelected && answerState === "incorrect"
                      ? "border-incorrect bg-incorrect/10 flash-incorrect"
                      : "border-[var(--card-border)] bg-[var(--card)] opacity-50"
              }`;

        return (
          <div key={option.id} className={showConfidenceSplit ? "relative" : ""}>
            <button
              type="button"
              onClick={() => handleSelect(option.id, undefined, "main")}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`${className} ${showConfidenceSplit ? (splitConfidenceMode === "full" ? "pr-44" : "pr-24") : ""}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    showFeedback && isCorrect
                      ? "bg-correct text-white"
                      : showFeedback && answerState === "incorrect" && isSelected
                        ? "bg-incorrect text-white"
                        : isSelected && mode === "exam"
                          ? "bg-brand-500 text-white"
                          : "bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  {showFeedback && isCorrect
                    ? "✓"
                    : showFeedback && answerState === "incorrect" && isSelected
                      ? "✗"
                      : displayLabel}
                </span>
                <span className="pt-0.5">{option.text}</span>
              </div>
            </button>
            {showConfidenceSplit && splitConfidenceMode === "full" && (
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                {quickConfidenceActions.map((quickAction) => (
                  <button
                    key={`${option.id}-${quickAction.value}`}
                    type="button"
                    disabled={disabled}
                    aria-label={`Answer ${displayLabel} as ${quickAction.label}`}
                    title={`Answer with ${quickAction.label.toLowerCase()} confidence (${quickAction.value}/5)`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelect(option.id, quickAction.value, "split");
                    }}
                    className="rounded-md border border-brand-400/40 bg-brand-500/20 px-1.5 py-1 text-[10px] font-semibold text-brand-100 hover:bg-brand-500/30 disabled:opacity-50"
                  >
                    {quickAction.shortLabel}
                  </button>
                ))}
              </div>
            )}
            {showConfidenceSplit && splitConfidenceMode === "high_only" && (
              <button
                type="button"
                disabled={disabled}
                aria-label={`Answer ${displayLabel} with high confidence`}
                title={`Answer with high confidence (${confidentConfidence}/5)`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelect(option.id, confidentConfidence, "split");
                }}
                className="absolute right-2 top-2 rounded-md border border-brand-400/40 bg-brand-500/20 px-2.5 py-1 text-[11px] font-semibold text-brand-100 hover:bg-brand-500/30 disabled:opacity-50"
              >
                High {confidentConfidence}/5
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
