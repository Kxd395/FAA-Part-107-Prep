import type { Question } from "@part107/core";

export type SourceTier = "FAA-anchored" | "Representative" | "Supplemental";

type SourceTierQuestion = Pick<Question, "citation" | "source" | "source_pdf">;

export function classifyQuestionSourceTier(question: SourceTierQuestion): SourceTier {
  const citation = (question.citation ?? "").toLowerCase();
  const source = (question.source ?? "").toLowerCase();
  const sourcePdf = (question.source_pdf ?? "").toLowerCase();

  if (
    /14\s*cfr|49\s*u\.?s\.?c|faa|aim|advisory circular|pilot'?s handbook/i.test(citation) ||
    sourcePdf.includes("faa")
  ) {
    return "FAA-anchored";
  }

  if (/part107-question-bank|review\.md|verified rules/i.test(source)) {
    return "Representative";
  }

  return "Supplemental";
}
