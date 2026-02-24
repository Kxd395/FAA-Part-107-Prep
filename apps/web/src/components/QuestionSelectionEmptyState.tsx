interface QuestionSelectionEmptyStateProps {
  context: "study" | "exam" | "learn" | "flashcards";
}

const CONTEXT_LABEL: Record<QuestionSelectionEmptyStateProps["context"], string> = {
  study: "study",
  exam: "exam",
  learn: "learn",
  flashcards: "flashcards",
};

export function QuestionSelectionEmptyState({ context }: QuestionSelectionEmptyStateProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status" aria-live="polite">
      No questions match this selection for {CONTEXT_LABEL[context]} mode. Try a different question pool or choose &quot;All Categories&quot;.
    </div>
  );
}
