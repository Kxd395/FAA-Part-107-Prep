/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const QUESTIONS_DIR = path.resolve(__dirname, "../questions");
const IMAGE_SECTION_PATTERN = /\s*###\s*Images[\s\S]*$/i;
const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*]\(([^)]+)\)/i;
const IMAGE_TAG_PATTERN = /`image=([^`]+)`/i;
const IMAGE_METADATA_PATTERN = /`(?:image|size|bbox_area_ratio)=[^`]+`/gi;
const CONTAMINATION_PATTERN =
  /###\s*Images|!\[[^\]]*]\([^)]+\)|`image=|`size=|`bbox_area_ratio=/i;

function normalizeInlineWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function toPublicImageRef(rawPath) {
  const trimmed = (rawPath || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) return trimmed;

  if (trimmed.startsWith("../")) {
    const withoutParent = trimmed.replace(/^\.\.\//, "");
    return `/${withoutParent}`;
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

function extractImageRef(text) {
  const markdownMatch = (text || "").match(IMAGE_MARKDOWN_PATTERN);
  if (markdownMatch && markdownMatch[1]) return toPublicImageRef(markdownMatch[1]);

  const tagMatch = (text || "").match(IMAGE_TAG_PATTERN);
  if (tagMatch && tagMatch[1]) return toPublicImageRef(tagMatch[1]);

  return null;
}

function sanitizeText(text) {
  return normalizeInlineWhitespace(
    (text || "")
      .replace(IMAGE_SECTION_PATTERN, "")
      .replace(/!\[[^\]]*]\([^)]+\)/g, "")
      .replace(IMAGE_METADATA_PATTERN, "")
      .replace(/\s+-\s*$/, "")
  );
}

function sanitizeFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const questions = JSON.parse(raw);
  let updatedCount = 0;

  for (const question of questions) {
    const candidates = [question.question_text, ...(question.options || []).map((o) => o.text)];
    const imageRef = candidates.map(extractImageRef).find(Boolean);

    const oldQuestionText = question.question_text;
    question.question_text = sanitizeText(question.question_text);
    if (oldQuestionText !== question.question_text) updatedCount++;

    for (const option of question.options || []) {
      const oldOptionText = option.text;
      option.text = sanitizeText(option.text);
      if (oldOptionText !== option.text) updatedCount++;
    }

    if (!question.image_ref && imageRef) {
      question.image_ref = imageRef;
      updatedCount++;
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(questions, null, 2)}\n`);

  const contaminatedRemaining = questions.reduce((count, q) => {
    let c = count;
    if (CONTAMINATION_PATTERN.test(q.question_text || "")) c++;
    for (const o of q.options || []) {
      if (CONTAMINATION_PATTERN.test(o.text || "")) c++;
    }
    return c;
  }, 0);

  return { updatedCount, contaminatedRemaining };
}

function main() {
  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(QUESTIONS_DIR, name));

  let totalUpdates = 0;
  let remaining = 0;

  for (const file of files) {
    const result = sanitizeFile(file);
    totalUpdates += result.updatedCount;
    remaining += result.contaminatedRemaining;
    console.log(
      `${path.basename(file)}: updated=${result.updatedCount} remaining_contaminated=${result.contaminatedRemaining}`
    );
  }

  console.log(`total_updates=${totalUpdates} remaining_contaminated=${remaining}`);
}

main();
