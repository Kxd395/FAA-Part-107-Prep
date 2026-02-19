import type { Question } from "@part107/core";

const IMAGE_SECTION_PATTERN = /\s*###\s*Images[\s\S]*$/i;
const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*]\(([^)]+)\)/i;
const IMAGE_TAG_PATTERN = /`image=([^`]+)`/i;
const IMAGE_METADATA_PATTERN = /`(?:image|size|bbox_area_ratio)=[^`]+`/gi;

function normalizeInlineWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toPublicImageRef(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("/")) return trimmed;

  if (trimmed.startsWith("../")) {
    const withoutParent = trimmed.replace(/^\.\.\//, "");
    return withoutParent.startsWith("images/") ? `/${withoutParent}` : `/${withoutParent}`;
  }

  if (trimmed.startsWith("images/")) {
    return `/${trimmed}`;
  }

  if (trimmed.includes("/images/")) {
    return trimmed.slice(trimmed.indexOf("/images/"));
  }

  if (/^[^/]+\.(png|jpe?g|webp|gif)$/i.test(trimmed)) {
    return `/images/uas-acsocr/${trimmed}`;
  }

  return trimmed;
}

export function extractImageRefFromText(text: string): string | null {
  const markdownMatch = text.match(IMAGE_MARKDOWN_PATTERN);
  if (markdownMatch?.[1]) {
    return toPublicImageRef(markdownMatch[1]);
  }

  const tagMatch = text.match(IMAGE_TAG_PATTERN);
  if (tagMatch?.[1]) {
    return toPublicImageRef(tagMatch[1]);
  }

  return null;
}

export function sanitizeQuestionText(text: string): string {
  const stripped = text
    .replace(IMAGE_SECTION_PATTERN, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(IMAGE_METADATA_PATTERN, "")
    .replace(/\s+-\s*$/, "");

  return normalizeInlineWhitespace(stripped);
}

export function sanitizeQuestion(question: Question): Question {
  const candidateTexts = [question.question_text, ...question.options.map((option) => option.text)];
  const extractedImageRef = candidateTexts.map(extractImageRefFromText).find(Boolean) ?? null;

  return {
    ...question,
    image_ref: question.image_ref ?? extractedImageRef,
    question_text: sanitizeQuestionText(question.question_text),
    options: question.options.map((option) => ({
      ...option,
      text: sanitizeQuestionText(option.text),
    })),
  };
}
