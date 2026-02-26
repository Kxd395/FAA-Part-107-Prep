#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const INPUT = path.join(
  REPO_ROOT,
  "docs/ssot/review/knokegeUpdate/more_questions.extracted.json"
);
const CANONICAL = path.join(
  REPO_ROOT,
  "packages/content/knowledge/combined_question_bank.canonical.json"
);
const OUTPUT = path.join(
  REPO_ROOT,
  "packages/content/knowledge/knokegeupdate_question_bank.curated.json"
);
const REPORT = path.join(
  REPO_ROOT,
  "docs/ssot/review/knokegeUpdate/MoreQuestionsImportReport.md"
);

function normalizeAscii(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/°/g, " degrees")
    .replace(/§\s*/g, "Sec. ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function signature(stem, options) {
  const normalizedOptions = options
    .map((option) => normalizeText(option).replace(/^[a-d][).:-]\s*/i, ""))
    .sort();
  return `${normalizeText(stem)}||${normalizedOptions.join("||")}`;
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapCategory(questionText) {
  const t = String(questionText ?? "").toLowerCase();
  if (
    /weather|metar|taf|wind|cloud|visibility|icing|fog|thunderstorm|microburst|civil twilight/.test(
      t
    )
  ) {
    return "Weather";
  }
  if (
    /airspace|sectional|chart|notam|class [bcdeg]|mtr|moa|prohibited|restricted|fria|atc|89\.130|foreign-registered/.test(
      t
    )
  ) {
    return "Airspace";
  }
  if (/load|performance|weight|balance|stall|center of gravity|cg/.test(t)) {
    return "Loading & Performance";
  }
  if (
    /maintenance|preflight|inspection|airport|radio|ctaf|unicom|multicom|runway|emergency|physiology|crm|adm|observer|control station|right-of-way/.test(
      t
    )
  ) {
    return "Operations";
  }
  return "Regulations";
}

function guessCitation(row) {
  const body = normalizeAscii(
    `${row.question ?? ""} ${row.A ?? ""} ${row.B ?? ""} ${row.C ?? ""} ${
      row.D ?? ""
    }`
  );
  const sectionMatch = body.match(/14\s*CFR\s*(?:Sec\.\s*)?(\d+\.\d+)/i);
  if (sectionMatch) return `14 CFR Sec. ${sectionMatch[1]}`;
  if (/civil twilight|anti-collision lights|night operations/i.test(body)) {
    return "14 CFR Sec. 107.29";
  }
  if (/remote id|fria|89\.130/i.test(body)) return "14 CFR Part 89";
  if (/14\s*CFR\s*Part\s*107/i.test(body)) return "14 CFR Part 107";
  return "FAA Remote Pilot Study Guide";
}

function toOptionId(index) {
  return ["A", "B", "C", "D"][index] ?? "A";
}

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Input file not found: ${INPUT}`);
    process.exit(1);
  }
  if (!fs.existsSync(CANONICAL)) {
    console.error(`Canonical file not found: ${CANONICAL}`);
    process.exit(1);
  }

  const parsed = loadJsonFile(INPUT);
  const sourceRows = Array.isArray(parsed?.all_extracted_questions)
    ? parsed.all_extracted_questions
    : [];
  const canonicalRows = loadJsonFile(CANONICAL);
  const canonicalSignatures = new Set(
    canonicalRows.map((row) => signature(row.question_text, row.options.map((option) => option.text)))
  );

  const kept = [];
  const dropped = [];
  const seenOutputSignatures = new Set();

  for (const row of sourceRows) {
    const questionNumber = String(row.question_number ?? "").trim();
    const questionText = normalizeAscii(row.question ?? "");
    const optionsRaw = [row.A, row.B, row.C, row.D].filter(
      (option) => typeof option === "string" && option.trim().length > 0
    );
    if (!questionNumber || !questionText || optionsRaw.length < 3) {
      dropped.push({
        question_number: questionNumber || "?",
        reason: "invalid_row",
        question: questionText || String(row.question ?? ""),
      });
      continue;
    }

    const category = mapCategory(questionText);
    if (category === "Regulations") {
      dropped.push({
        question_number: questionNumber,
        reason: "regulations_excluded_by_policy",
        question: questionText,
      });
      continue;
    }

    const normalizedOptions = optionsRaw.map((option) => normalizeAscii(option));
    const rowSignature = signature(questionText, normalizedOptions);
    if (canonicalSignatures.has(rowSignature) || seenOutputSignatures.has(rowSignature)) {
      dropped.push({
        question_number: questionNumber,
        reason: "duplicate_signature",
        question: questionText,
      });
      continue;
    }

    seenOutputSignatures.add(rowSignature);
    const correctOptionId = normalizeAscii(row.correct_answer ?? "").toUpperCase();
    if (!["A", "B", "C", "D"].includes(correctOptionId)) {
      dropped.push({
        question_number: questionNumber,
        reason: "invalid_correct_answer",
        question: questionText,
      });
      continue;
    }

    const citation = guessCitation(row);
    kept.push({
      id: `KUP-${questionNumber.padStart(3, "0")}`,
      category,
      subcategory:
        slug(questionText)
          .split("_")
          .slice(0, 3)
          .join(" ")
          .replace(/\b\w/g, (char) => char.toUpperCase()) || "Supplemental",
      question_text: questionText,
      figure_reference: null,
      image_ref: null,
      figure_text: null,
      options: normalizedOptions.map((text, index) => ({
        id: toOptionId(index),
        text,
      })),
      correct_option_id: correctOptionId,
      explanation_correct: `Answer sourced from ${citation}.`,
      explanation_distractors: {},
      citation,
      difficulty_level: 2,
      source: "knokegeupdate-docx-supplement",
      source_type: "resource_pack",
      tags: ["knokegeupdate-supplement", slug(category)],
      concept_key: `kup:${slug(category)}|${slug(questionText).split("_").slice(0, 8).join("_")}`,
    });
  }

  fs.writeFileSync(OUTPUT, `${JSON.stringify(kept, null, 2)}\n`);

  const reportLines = [
    "# More Questions Import Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source rows: **${sourceRows.length}**`,
    `- Kept rows: **${kept.length}**`,
    `- Dropped rows: **${dropped.length}**`,
    "- Keep policy: non-Regulations only (target category-gap fill), plus signature dedupe.",
    "",
    "## Kept IDs",
    "",
    kept.length > 0
      ? kept.map((row) => `- ${row.id} | ${row.category} | ${row.question_text}`).join("\n")
      : "- None",
    "",
    "## Dropped IDs",
    "",
    dropped.length > 0
      ? dropped
          .map(
            (row) =>
              `- Q${row.question_number} | ${row.reason} | ${row.question}`
          )
          .join("\n")
      : "- None",
    "",
  ];
  fs.writeFileSync(REPORT, reportLines.join("\n"));

  console.log(
    `Built knokegeUpdate supplement: kept ${kept.length}/${sourceRows.length} -> ${OUTPUT}`
  );
  console.log(`Report: ${REPORT}`);
}

main();
