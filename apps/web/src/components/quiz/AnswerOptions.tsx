import type { OptionId, QuestionOption } from "@part107/core";

type AnswerState = "unanswered" | "correct" | "incorrect";

interface AnswerOptionsProps {
  options: QuestionOption[];
  mode: "study" | "exam";
  selectedOption: OptionId | null;
  correctOptionId?: OptionId;
  answerState?: AnswerState;
  onSelect: (optionId: OptionId) => void;
  disabled?: boolean;
}

export default function AnswerOptions({
  options,
  mode,
  selectedOption,
  correctOptionId,
  answerState = "unanswered",
  onSelect,
  disabled = false,
}: AnswerOptionsProps) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = selectedOption === option.id;
        const isCorrect = correctOptionId === option.id;
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
                  ? "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/50 hover:bg-brand-500/5"
                  : isCorrect
                    ? "border-correct bg-correct/10 flash-correct"
                    : isSelected && answerState === "incorrect"
                      ? "border-incorrect bg-incorrect/10 flash-incorrect"
                      : "border-[var(--card-border)] bg-[var(--card)] opacity-50"
              }`;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={className}
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
                    : option.id}
              </span>
              <span className="pt-0.5">{option.text}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
