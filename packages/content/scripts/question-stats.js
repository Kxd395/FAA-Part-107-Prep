#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "questions");

function loadData() {
  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    const items = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf8"));
    return { file, items };
  });
}

function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function printMap(title, map) {
  console.log(`\n${title}`);
  [...map.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .forEach(([k, v]) => console.log(`- ${k}: ${v}`));
}

function main() {
  const datasets = loadData();

  let total = 0;
  const byCategory = new Map();
  const byDifficulty = new Map();
  const byOptionCount = new Map();
  const bySourceType = new Map();
  let missingCitation = 0;
  let missingAcsCode = 0;

  console.log("Per-file counts");
  for (const { file, items } of datasets) {
    console.log(`- ${file}: ${items.length}`);
    total += items.length;

    for (const q of items) {
      inc(byCategory, q.category || "(missing)");
      inc(byDifficulty, q.difficulty_level || "(missing)");
      inc(byOptionCount, Array.isArray(q.options) ? q.options.length : "(invalid)");
      inc(bySourceType, q.source_type || "(unspecified)");
      if (!q.citation) missingCitation++;
      if (!q.acs_code) missingAcsCode++;
    }
  }

  console.log(`\nTotal questions: ${total}`);
  console.log(`Missing citation: ${missingCitation}`);
  console.log(`Missing acs_code: ${missingAcsCode}`);

  printMap("By category", byCategory);
  printMap("By difficulty", byDifficulty);
  printMap("By option count", byOptionCount);
  printMap("By source_type", bySourceType);
}

main();
