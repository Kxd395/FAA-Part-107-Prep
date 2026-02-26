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
}

export default function QuestionTypeOptionsGrid({
  title = "Question Type",
  options,
  selectedQuestionType,
  onSelectQuestionType,
  note = null,
}: QuestionTypeOptionsGridProps) {
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
