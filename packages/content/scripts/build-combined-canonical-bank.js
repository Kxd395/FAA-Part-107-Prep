#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const INPUT = path.join(REPO_ROOT, "docs/ssot/review/knokegeUpdate/combined_question_bank.json");
const OUTPUT = path.join(REPO_ROOT, "packages/content/knowledge/combined_question_bank.canonical.json");

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapTopicToCategory(topic) {
  const t = String(topic ?? "").toLowerCase();
  if (/weather|metar|taf|wind|cloud|visibility|icing|fog|thunderstorm|microburst/.test(t)) {
    return "Weather";
  }
  if (/airspace|sectional|chart|notam|class [bcdeg]|mtr|moa|prohibited|restricted|tfr/.test(t)) {
    return "Airspace";
  }
  if (/load|performance|weight|balance|stall|center of gravity|cg/.test(t)) {
    return "Loading & Performance";
  }
  if (/maintenance|preflight|inspection|airport|radio|ctaf|unicom|multicom|runway|emergency|physiology|crm|adm/.test(t)) {
    return "Operations";
  }
  return "Regulations";
}

function toOptionId(index) {
  return ["A", "B", "C", "D"][index] ?? "A";
}

function deriveConceptKey(reference, topic) {
  const ref = String(reference ?? "");
  const cfr = ref.match(/14\s*cfr(?:\s*part)?\s*(?:§\s*)?(\d+(?:\.\d+)?)/i);
  if (cfr) {
    return `cfr:${cfr[1]}|${slug(topic || "general")}`;
  }
  const acs = ref.match(/\b(UA\.[IVX]+\.[A-Z]\.K\d+[A-Z]?)\b/i);
  if (acs) {
    return `acs:${acs[1].toUpperCase()}|${slug(topic || "general")}`;
  }
  const sourcePrefix = Number.isFinite(Number(reference)) ? "q" : "merged";
  return `${sourcePrefix}:${slug(topic || "general")}|${slug(ref || "general")}`;
}

function normalizeImageRef(value) {
  if (!value || !String(value).trim()) return null;
  const trimmed = String(value).trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function questionSignature(question) {
  const stem = normalizeText(question.question_text).toLowerCase();
  const options = question.options
    .map((option) => normalizeText(option.text).toLowerCase().replace(/^[a-d][).:-]\s*/i, ""))
    .sort();
  return `${stem}||${options.join("||")}`;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Combined input not found: ${INPUT}`);
    process.exit(1);
  }

  const rawRows = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  if (!Array.isArray(rawRows)) {
    console.error("Combined input must be an array.");
    process.exit(1);
  }

  const mapped = [];
  for (const raw of rawRows) {
    const numericId = Number(raw.id);
    if (!Number.isFinite(numericId)) continue;

    const options = Array.isArray(raw.options) ? raw.options.map((opt) => normalizeText(opt)) : [];
    if (options.length < 2 || options.length > 4) continue;

    const answerIndex = Number(raw.correct_answer_index);
    const boundedAnswerIndex =
      Number.isFinite(answerIndex) && answerIndex >= 0 && answerIndex < options.length
        ? answerIndex
        : 0;

    const topic = normalizeText(raw.topic || "General");
    const reference = normalizeText(raw.reference || "Combined Question Bank");
    const sourceName = numericId <= 100 ? "part107-question-bank" : "carrington-question-bank-strict";
    const tags = [numericId <= 100 ? "part107-bank" : "carrington-bank", slug(topic)];

    mapped.push({
      id: numericId <= 100 ? `P107-${String(numericId).padStart(3, "0")}` : `CAR-${String(numericId).padStart(3, "0")}`,
      category: mapTopicToCategory(topic),
      subcategory: topic,
      question_text: normalizeText(raw.question),
      figure_reference: null,
      image_ref: normalizeImageRef(raw.image_url),
      figure_text:
        raw.image_required === true ? normalizeText(raw.image_description || "") || null : null,
      options: options.map((text, idx) => ({
        id: toOptionId(idx),
        text,
      })),
      correct_option_id: toOptionId(boundedAnswerIndex),
      explanation_correct: `Answer sourced from ${reference}.`,
      explanation_distractors: {},
      citation: reference,
      difficulty_level: 2,
      source: sourceName,
      source_type: "resource_pack",
      tags,
      concept_key: deriveConceptKey(reference, topic),
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const question of mapped) {
    const signature = questionSignature(question);
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(question);
  }

  fs.writeFileSync(OUTPUT, `${JSON.stringify(deduped, null, 2)}\n`);
  console.log(`Built canonical merged bank: ${deduped.length} questions -> ${OUTPUT}`);
}

main();
