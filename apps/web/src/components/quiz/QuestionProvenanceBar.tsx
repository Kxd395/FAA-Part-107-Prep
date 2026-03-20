"use client";

import type { Question } from "@part107/core";
import { classifyQuestionSourceTier } from "../../lib/sourceTier";

type ProvenanceQuestion = Pick<
  Question,
  "acs_code" | "citation" | "source" | "source_type" | "source_pdf" | "year_updated"
>;

function formatSourceType(value: string | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function classifySourceTier(question: ProvenanceQuestion): {
  label: string;
  className: string;
} {
  const tier = classifyQuestionSourceTier(question);
  if (tier === "FAA-anchored") {
    return {
      label: tier,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (tier === "Representative") {
    return {
      label: tier,
      className: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    };
  }

  return {
    label: tier,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
}

interface QuestionProvenanceBarProps {
  question: ProvenanceQuestion;
}

export default function QuestionProvenanceBar({ question }: QuestionProvenanceBarProps) {
  const sourceTier = classifySourceTier(question);
  const formattedSourceType = formatSourceType(question.source_type);

  return (
    <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${sourceTier.className}`}>
          Source Tier: {sourceTier.label}
        </span>
        {question.acs_code && (
          <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px] text-white">
            ACS: {question.acs_code}
          </span>
        )}
        {question.year_updated && (
          <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
            Reviewed: {question.year_updated}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {question.citation && (
          <span>
            <span className="text-white">Reference:</span> {question.citation}
          </span>
        )}
        {question.source && (
          <span>
            <span className="text-white">Source:</span> {question.source}
          </span>
        )}
        {formattedSourceType && (
          <span>
            <span className="text-white">Type:</span> {formattedSourceType}
          </span>
        )}
      </div>
    </div>
  );
}
