import type { Question } from "@part107/core";

const ACS_CODE_OPTION_PATTERN = /^UA\.[A-Z0-9]+\.[A-Z0-9]+\.[A-Z]\d+[A-Z0-9]*$/i;
const ACS_MASTERY_TAG = "acs-mastery";

function cloneOptions(options: Question["options"]): Question["options"] {
  return options.map((option) => ({ ...option }));
}

function normalizeTopicText(input: string): string {
  const trimmed = input.trim().replace(/[“”]/g, "\"").replace(/\s+/g, " ");
  return trimmed.replace(/["'.:;?!\s]+$/g, "").trim();
}

function extractTopicFromCodePrompt(questionText: string): string | null {
  const match = questionText.match(/matches this topic:\s*["“]?([\s\S]*?)["”]?\s*\??$/i);
  if (!match?.[1]) return null;
  const normalized = normalizeTopicText(match[1]);
  return normalized.length > 0 ? normalized : null;
}

function isAcsCodeOption(text: string): boolean {
  return ACS_CODE_OPTION_PATTERN.test(text.trim());
}

export function isCodeOnlyAnswerQuestion(question: Question): boolean {
  return (
    question.options.length > 0 &&
    question.options.every((option) => isAcsCodeOption(option.text))
  );
}

interface WordTemplate {
  options: Question["options"];
  correctOptionId: Question["correct_option_id"];
  citation: string;
}

function buildWordTemplateByAcsCode(questions: readonly Question[]): Map<string, WordTemplate> {
  const map = new Map<string, WordTemplate>();

  for (const question of questions) {
    const acsCode = question.acs_code?.trim().toUpperCase();
    if (!acsCode || isCodeOnlyAnswerQuestion(question) || map.has(acsCode)) continue;

    map.set(acsCode, {
      options: cloneOptions(question.options),
      correctOptionId: question.correct_option_id,
      citation: question.citation,
    });
  }

  return map;
}

function buildDistractorExplanations(options: Question["options"], correctOptionId: string) {
  return Object.fromEntries(
    options
      .filter((option) => option.id !== correctOptionId)
      .map((option) => [option.id, `${option.text} is not the best match for this topic.`])
  ) as Question["explanation_distractors"];
}

function stripAcsMasteryTag(tags: string[]): string[] {
  return tags.filter((tag) => tag.trim().toLowerCase() !== ACS_MASTERY_TAG);
}

export function normalizeAcsCodeOnlyQuestions(questions: readonly Question[]): Question[] {
  const templates = buildWordTemplateByAcsCode(questions);

  return questions.map((question) => {
    if (!isCodeOnlyAnswerQuestion(question)) return question;

    const acsCode = question.acs_code?.trim().toUpperCase();
    if (!acsCode) return question;
    const template = templates.get(acsCode);
    if (!template) return question;

    const topic = extractTopicFromCodePrompt(question.question_text);
    const promptTopic = topic ? `"${topic}"` : "this Part 107 knowledge area";
    const correctOptionText =
      template.options.find((option) => option.id === template.correctOptionId)?.text ?? "the correct concept";

    return {
      ...question,
      question_text: `Which concept best matches this Part 107 topic: ${promptTopic}?`,
      options: cloneOptions(template.options),
      correct_option_id: template.correctOptionId,
      explanation_correct: `The best topic match is ${correctOptionText}.`,
      explanation_distractors: buildDistractorExplanations(template.options, template.correctOptionId),
      citation: template.citation,
      tags: stripAcsMasteryTag(question.tags),
      source: `${question.source ?? "ACS"} (word-normalized)`,
    };
  });
}
