import type { OptionId, Question, QuestionOption } from "@part107/core";

const DISPLAY_LABELS: readonly OptionId[] = ["A", "B", "C", "D"];

export interface PresentedOption extends QuestionOption {
  displayLabel: OptionId;
}

export interface OptionPresentation {
  options: PresentedOption[];
  displayLabelByOptionId: Partial<Record<OptionId, OptionId>>;
  correctDisplayLabel: OptionId;
}

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const output = [...items];
  const rng = mulberry32(seed);

  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }

  return output;
}

export function buildOptionPresentation(
  question: Pick<Question, "id" | "options" | "correct_option_id">,
  contextKey: string
): OptionPresentation {
  const shuffled = shuffleDeterministic(
    question.options,
    hashString(`${contextKey}:${question.id}:options`)
  );

  const displayLabelByOptionId: Partial<Record<OptionId, OptionId>> = {};
  const options: PresentedOption[] = shuffled.map((option, index) => {
    const displayLabel = DISPLAY_LABELS[index] ?? option.id;
    displayLabelByOptionId[option.id] = displayLabel;
    return {
      ...option,
      displayLabel,
    };
  });

  const correctDisplayLabel =
    displayLabelByOptionId[question.correct_option_id] ?? question.correct_option_id;

  return {
    options,
    displayLabelByOptionId,
    correctDisplayLabel,
  };
}

export function getDisplayLabelForOption(
  displayLabelByOptionId: Partial<Record<OptionId, OptionId>>,
  optionId: OptionId | null | undefined
): string {
  if (!optionId) return "Unanswered";
  return displayLabelByOptionId[optionId] ?? optionId;
}

export function getOptionTextById(
  options: readonly QuestionOption[],
  optionId: OptionId | null | undefined
): string | null {
  if (!optionId) return null;
  return options.find((option) => option.id === optionId)?.text ?? null;
}
