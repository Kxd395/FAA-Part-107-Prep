import type { OptionId, Question, QuestionOption } from "@part107/core";

const DISPLAY_LABELS: readonly OptionId[] = ["A", "B", "C"];
const DEFAULT_PRESENTED_OPTION_COUNT = DISPLAY_LABELS.length;

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

function selectPresentedOptions(
  question: Pick<Question, "id" | "options" | "correct_option_id">,
  contextKey: string,
  maxOptions: number
): QuestionOption[] {
  if (question.options.length <= maxOptions) {
    return [...question.options];
  }

  const correct = question.options.find((option) => option.id === question.correct_option_id);
  const distractors = question.options.filter((option) => option.id !== question.correct_option_id);
  if (!correct || distractors.length === 0) {
    return [...question.options].slice(0, maxOptions);
  }

  const shuffledDistractors = shuffleDeterministic(
    distractors,
    hashString(`${contextKey}:${question.id}:distractors`)
  );
  const selectedDistractors = shuffledDistractors.slice(0, Math.max(0, maxOptions - 1));
  return [correct, ...selectedDistractors];
}

export function buildOptionPresentation(
  question: Pick<Question, "id" | "options" | "correct_option_id">,
  contextKey: string,
  maxOptions: number = DEFAULT_PRESENTED_OPTION_COUNT
): OptionPresentation {
  const selected = selectPresentedOptions(
    question,
    contextKey,
    Math.max(2, Math.min(DEFAULT_PRESENTED_OPTION_COUNT, maxOptions))
  );
  const shuffled = shuffleDeterministic(
    selected,
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
