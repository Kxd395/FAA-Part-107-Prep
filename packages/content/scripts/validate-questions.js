#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "questions");

const REQUIRED_FIELDS = [
  "id",
  "category",
  "subcategory",
  "question_text",
  "options",
  "correct_option_id",
  "explanation_correct",
  "explanation_distractors",
  "citation",
  "difficulty_level",
];

const VALID_OPTION_IDS = new Set(["A", "B", "C", "D"]);
const VALID_CORRECT_IDS = new Set(["A", "B", "C", "D"]);

function loadQuestionFiles() {
  return fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function validateQuestion(q, file, idx, errors) {
  const where = `${file}#${idx + 1}`;

  for (const field of REQUIRED_FIELDS) {
    if (q[field] === undefined || q[field] === null || q[field] === "") {
      errors.push(`${where}: missing required field '${field}'`);
    }
  }

  if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 4) {
    errors.push(`${where}: options must contain 3 or 4 choices`);
  } else {
    const ids = q.options.map((opt) => opt.id);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      errors.push(`${where}: duplicate option IDs in options[]`);
    }
    for (const id of ids) {
      if (!VALID_OPTION_IDS.has(id)) {
        errors.push(`${where}: invalid option id '${id}'`);
      }
    }
    if (typeof q.correct_option_id === "string" && !ids.includes(q.correct_option_id)) {
      errors.push(`${where}: correct_option_id '${q.correct_option_id}' is not present in options[]`);
    }
  }

  if (!VALID_CORRECT_IDS.has(q.correct_option_id)) {
    errors.push(`${where}: invalid correct_option_id '${q.correct_option_id}'`);
  }

  if (
    typeof q.difficulty_level !== "number" ||
    q.difficulty_level < 1 ||
    q.difficulty_level > 3
  ) {
    errors.push(`${where}: difficulty_level must be an integer 1..3`);
  }
}

function main() {
  const files = loadQuestionFiles();
  const errors = [];
  let total = 0;

  for (const file of files) {
    const fullPath = path.join(QUESTIONS_DIR, file);
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (!Array.isArray(parsed)) {
      errors.push(`${file}: root must be an array`);
      continue;
    }

    parsed.forEach((q, idx) => validateQuestion(q, file, idx, errors));
    total += parsed.length;
  }

  if (errors.length > 0) {
    console.error(`\nValidation failed with ${errors.length} issue(s):`);
    errors.slice(0, 100).forEach((e) => console.error(`- ${e}`));
    if (errors.length > 100) {
      console.error(`...and ${errors.length - 100} more`);
    }
    process.exit(1);
  }

  console.log(`Validated ${total} questions across ${files.length} files. No errors found.`);
}

main();
