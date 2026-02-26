#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SOURCE = path.join(REPO_ROOT, "docs/ssot/review/carrington_question_bank.json");
const BACKUP = path.join(REPO_ROOT, "docs/ssot/review/carrington_question_bank.untrimmed.json");
const REPORT = path.join(REPO_ROOT, "docs/ssot/review/CarringtonTrimReport.md");
const STRICT_OUTPUT = path.join(REPO_ROOT, "docs/ssot/review/carrington_question_bank.strict.json");
const STRICT_REPORT = path.join(REPO_ROOT, "docs/ssot/review/CarringtonTrimReport.strict.md");

const FAA_KEYWORDS = [
  /\bfaa\b/i,
  /\bpart\s*107\b/i,
  /\b14\s*cfr\b/i,
  /\bremote\s+pilot\b/i,
  /\bclass\s*[abcde]\b/i,
  /\bairspace\b/i,
  /\blaanc\b/i,
  /\bnotams?\b/i,
  /\btfrs?\b/i,
  /\bctaf\b/i,
  /\batc\b/i,
  /\bmetar\b/i,
  /\btaf\b/i,
  /\bvlos\b/i,
  /\bremote\s+id\b/i,
  /\boperations?\s+over\s+people\b/i,
  /\bnight\b/i,
  /\banti-?collision\b/i,
  /\bload\s+factor\b/i,
  /\bcenter\s+of\s+gravity\b/i,
  /\bpre-?flight\b/i,
  /\bmaintenance\b/i,
  /\bairport\b/i,
  /\bweather\b/i,
  /\bwaiver\b/i,
  /\balcohol\b/i,
  /\bfatigue\b/i,
  /\buas\b/i,
  /\bsuas\b/i,
  /\bdrone\b/i,
];

const DOMAIN_KEYWORDS = [
  /\bweather\b/i,
  /\bwind\b/i,
  /\bvisibility\b/i,
  /\brunway\b/i,
  /\bgps\b/i,
  /\bfirmware\b/i,
  /\bbattery\b/i,
  /\bpayload\b/i,
  /\bmaintenance\b/i,
  /\bpre-?flight\b/i,
  /\bairport\b/i,
  /\bemergency\b/i,
  /\bcommunication\b/i,
  /\bradio\b/i,
  /\bobserver\b/i,
  /\btraffic\b/i,
];

const GENERIC_BLOCKLIST = [
  /halo effect/i,
  /scenario analysis/i,
  /ethical decision-making/i,
  /psychological impact/i,
  /dynamic uas environments/i,
  /standards of ethical/i,
  /not a method to overcome cognitive biases/i,
  /what is not a method to overcome/i,
];

const STRICT_BLOCKLIST = [
  ...GENERIC_BLOCKLIST,
  /in dynamic uas environments/i,
  /what is not/i,
  /which strategy is least effective/i,
  /if .*? grams|kg|centimeter|cm|counterweight/i,
];

function normalizeText(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s) {
  return normalizeText(s).split(/\s+/).filter(Boolean).length;
}

function hasFaaSignal(question, reference, citation) {
  const blob = `${question} ${reference ?? ""} ${citation ?? ""}`;
  return FAA_KEYWORDS.some((pattern) => pattern.test(blob));
}

function hasDomainSignal(question) {
  return DOMAIN_KEYWORDS.some((pattern) => pattern.test(question));
}

function hasStrictFaaSignal(question, reference, citation) {
  const blob = `${question} ${reference ?? ""} ${citation ?? ""}`;
  return [
    /\bfaa\b/i,
    /\bpart\s*107\b/i,
    /\b14\s*cfr\b/i,
    /\bclass\s*[abcde]\b/i,
    /\blaanc\b/i,
    /\bnotams?\b/i,
    /\btfrs?\b/i,
    /\bctaf\b/i,
    /\batc\b/i,
    /\bmetar\b/i,
    /\btaf\b/i,
    /\bvlos\b/i,
    /\bremote\s+id\b/i,
    /\boperations?\s+over\s+people\b/i,
    /\banti-?collision\b/i,
    /\bwaiver\b/i,
    /\balcohol\b/i,
    /\bfatigue\b/i,
  ].some((pattern) => pattern.test(blob));
}

function uniqueOptionCount(options) {
  return new Set((options ?? []).map((opt) => normalizeText(opt).toLowerCase())).size;
}

function shouldKeep(row, strictMode) {
  const question = normalizeText(row.question);
  const options = Array.isArray(row.options) ? row.options.map((o) => normalizeText(o)) : [];
  const reasons = [];

  if (!question || !question.endsWith("?")) reasons.push("question_format");
  const words = wordCount(question);
  if (strictMode) {
    if (words < 8 || words > 32) reasons.push("question_length");
  } else if (words < 7 || words > 45) {
    reasons.push("question_length");
  }

  if (options.length < 3 || options.length > 4) reasons.push("option_count");
  if (uniqueOptionCount(options) < 3) reasons.push("option_quality");

  if (strictMode) {
    if (!hasStrictFaaSignal(question, row.reference, row.faa_citation)) {
      reasons.push("strict_faa_signal_missing");
    }
  } else if (!hasFaaSignal(question, row.reference, row.faa_citation) && !hasDomainSignal(question)) {
    reasons.push("faa_signal_missing");
  }

  const blocklist = strictMode ? STRICT_BLOCKLIST : GENERIC_BLOCKLIST;
  if (blocklist.some((re) => re.test(question))) reasons.push("generic_topic_blocked");

  return {
    keep: reasons.length === 0,
    reasons,
  };
}

function writeReport(total, kept, removed, reportPath, strictMode, inputPath, outputPath) {
  const lines = [];
  lines.push(strictMode ? "# Carrington Strict Trim Report" : "# Carrington Trim Report");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Mode: **${strictMode ? "strict" : "standard"}**`);
  lines.push(`- Input: \`${inputPath}\``);
  lines.push(`- Output: \`${outputPath}\``);
  lines.push(`- Total input rows: **${total}**`);
  lines.push(`- Kept rows: **${kept.length}**`);
  lines.push(`- Removed rows: **${removed.length}**`);
  lines.push("");

  const byReason = {};
  for (const item of removed) {
    for (const reason of item.reasons) {
      byReason[reason] = (byReason[reason] || 0) + 1;
    }
  }
  lines.push("## Removal Reasons");
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push("");
  lines.push("## Removed Samples");
  lines.push("| ID | Reasons | Question |");
  lines.push("|---|---|---|");
  for (const item of removed.slice(0, 120)) {
    const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
    lines.push(`| ${esc(item.row.id)} | ${esc(item.reasons.join(", "))} | ${esc(item.row.question)} |`);
  }
  lines.push("");

  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function main() {
  const strictMode = process.argv.includes("--strict");
  const inputPath = strictMode && fs.existsSync(BACKUP) ? BACKUP : SOURCE;
  const outputPath = strictMode ? STRICT_OUTPUT : SOURCE;
  const reportPath = strictMode ? STRICT_REPORT : REPORT;

  if (!fs.existsSync(inputPath)) {
    console.error(`Carrington bank missing: ${inputPath}`);
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("Carrington bank is not an array.");
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP)) {
    fs.writeFileSync(BACKUP, `${JSON.stringify(rows, null, 2)}\n`);
  }

  const kept = [];
  const removed = [];
  for (const row of rows) {
    const decision = shouldKeep(row, strictMode);
    if (decision.keep) kept.push(row);
    else removed.push({ row, reasons: decision.reasons });
  }

  const renumbered = kept.map((row, index) => ({
    ...row,
    id: index + 1,
  }));
  fs.writeFileSync(outputPath, `${JSON.stringify(renumbered, null, 2)}\n`);
  writeReport(rows.length, renumbered, removed, reportPath, strictMode, inputPath, outputPath);

  console.log(
    `Carrington ${strictMode ? "strict " : ""}trim complete: kept ${renumbered.length}/${rows.length}. Backup: ${BACKUP}. Output: ${outputPath}. Report: ${reportPath}`
  );
}

main();
