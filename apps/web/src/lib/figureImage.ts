import type { Question } from "@part107/core";

export function resolveFigureImageUrl(
  question: Pick<Question, "image_ref" | "figure_reference">
): string | null {
  const explicit = typeof question.image_ref === "string" ? question.image_ref.trim() : "";
  if (explicit) return explicit;
  const figureRef = question.figure_reference?.trim();
  if (!figureRef) return null;

  if (/^figure-\d+-\d+$/i.test(figureRef)) {
    return `/figures/rpsg-2016/rpsg2016-${figureRef.toLowerCase()}.jpeg`;
  }

  return `/figures/${figureRef}.png`;
}
