"use client";

import type { ReactNode } from "react";
import type { QuestionTypeProfile } from "@part107/core";
import type { QuestionTypeOption } from "../lib/questionTypeOptions";

interface QuestionTypeOptionsGridProps {
  title?: string;
  options: readonly QuestionTypeOption[];
  selectedQuestionType: QuestionTypeProfile;
  onSelectQuestionType: (value: QuestionTypeProfile) => void;
  note?: ReactNode;
  variant?: "default" | "compact";
}

export default function QuestionTypeOptionsGrid({
  title = "Question Type",
  options,
  selectedQuestionType,
  onSelectQuestionType,
  note = null,
  variant = "default",
}: QuestionTypeOptionsGridProps) {
  const selectedOption = options.find((option) => option.value === selectedQuestionType) ?? null;

  if (variant === "compact") {
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelectQuestionType(option.value)}
                aria-pressed={selectedQuestionType === option.value}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedQuestionType === option.value
                    ? "border-brand-500/60 bg-brand-500/10 text-white"
                    : "border-[var(--card-border)] bg-[var(--background)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {option.title}
              </button>
            ))}
          </div>
          {selectedOption && (
            <div className="mt-2 text-xs text-[var(--muted)]">{selectedOption.description}</div>
          )}
        </div>
        {note}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelectQuestionType(option.value)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              selectedQuestionType === option.value
                ? "border-brand-500/60 bg-brand-500/10"
                : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
            }`}
          >
            <div className="text-sm font-semibold text-white">{option.title}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{option.description}</div>
          </button>
        ))}
      </div>
      {note}
    </div>
  );
}
