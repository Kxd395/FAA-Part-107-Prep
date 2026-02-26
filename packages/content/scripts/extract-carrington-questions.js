#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SOURCE_PATH = path.join(REPO_ROOT, "source-materials/Drone_Exam_Prep_Carrington.md");
const OUTPUT_PATH = path.join(REPO_ROOT, "docs/ssot/review/carrington_question_bank.json");

function normalizeWhitespace(input) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function cleanLine(input) {
  return normalizeWhitespace(
    input
      .replace(/\[\]\{#[^}]+\}/g, " ")
      .replace(/\{\.class_[^}]+\}/g, " ")
      .replace(/`<\/?image[^`]*>`\{=html\}/g, " ")
      .replace(/<\/?svg[^>]*>/g, " ")
      .replace(/<\/?image[^>]*>/g, " ")
      .replace(/^:::\s*\{\}\s*$/, " ")
      .replace(/^:::\s*$/, " ")
      .replace(/^\[\]\{#[^}]+\}\s*$/, " ")
      .replace(/\\\./g, ".")
      .replace(/\[(.*?)\]/g, "$1")
  );
}

function normalizeQuestionText(input) {
  return normalizeWhitespace(input.replace(/^\d+\.\s*/, ""));
}

function normalizeOptionText(input) {
  return normalizeWhitespace(
    input
      .replace(/^[-–•\s]+/, "")
      .replace(/[▢□]/g, " ")
      .replace(/^\[+|\]+$/g, " ")
      .replace(/\[|\]/g, " ")
  );
}

function inferTopic(question) {
  const q = question.toLowerCase();
  if (/metar|taf|weather|thunderstorm|wind shear|cloud|visibility|inversion|density altitude/.test(q)) {
    return "Weather";
  }
  if (/airspace|class [bcdeg]|sectional|ctaf|notam|tfr|restricted|prohibited|moa|warning area/.test(q)) {
    return "Airspace";
  }
  if (/load factor|center of gravity|angle of attack|stall|performance|weight/.test(q)) {
    return "Loading & Performance";
  }
  if (/fatigue|alcohol|maintenance|preflight|crm|crew resource|airport|emergency|radio/.test(q)) {
    return "Operations";
  }
  return "Regulations";
}

function parseOptionLine(line) {
  const match = line.match(/^\s*([A-D])\.\s*(.*)$/i);
  if (!match) return null;
  return {
    letter: match[1].toUpperCase(),
    text: normalizeOptionText(match[2] || ""),
  };
}

function parseAnswerLetter(line) {
  const match = line.match(/\bAnswer:\s*([A-D])\./i);
  return match ? match[1].toUpperCase() : null;
}

function isQuestionStart(line) {
  return /^\d+\.\s+.+/.test(line);
}

function isSkippableLine(line) {
  if (!line) return true;
  if (/^(table of content|introduction|mock exam|drone exam prep|conclusion)$/i.test(line)) return true;
  if (/^explanation:/i.test(line)) return true;
  return false;
}

function extractQuestions(content) {
  const lines = content
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => !isSkippableLine(line));

  const extracted = [];

  for (let i = 0; i < lines.length; i += 1) {
    const start = lines[i];
    if (!isQuestionStart(start)) continue;

    let j = i;
    const questionParts = [start.replace(/^\d+\.\s*/, "").trim()];
    while (j + 1 < lines.length) {
      const next = lines[j + 1];
      if (!next || isQuestionStart(next) || parseOptionLine(next) || parseAnswerLetter(next)) break;
      if (/^(A|B|C|D)\.$/.test(next)) break;
      questionParts.push(next);
      j += 1;
    }
    const question = normalizeQuestionText(questionParts.join(" "));
    if (!question.includes("?")) {
      i = j;
      continue;
    }

    const optionByLetter = new Map();
    let currentOption = null;
    let answerLetter = null;
    j += 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (!line) continue;
      if (isQuestionStart(line)) break;

      const answer = parseAnswerLetter(line);
      if (answer) {
        answerLetter = answer;
        break;
      }

      const opt = parseOptionLine(line);
      if (opt) {
        currentOption = opt.letter;
        optionByLetter.set(opt.letter, opt.text);
        continue;
      }

      if (currentOption && !isSkippableLine(line)) {
        const prev = optionByLetter.get(currentOption) ?? "";
        optionByLetter.set(currentOption, normalizeOptionText(`${prev} ${line}`));
      }
    }

    const letters = ["A", "B", "C", "D"].filter((letter) => optionByLetter.has(letter));
    if (!answerLetter || letters.length < 3 || !optionByLetter.has(answerLetter)) {
      i = j;
      continue;
    }

    const options = letters.map((letter) => normalizeOptionText(optionByLetter.get(letter) || ""));
    const uniqueOptions = new Set(options.map((opt) => opt.toLowerCase()));
    if (uniqueOptions.size < 3) {
      i = j;
      continue;
    }

    const correctIndex = letters.indexOf(answerLetter);
    if (correctIndex < 0) {
      i = j;
      continue;
    }

    extracted.push({
      question,
      options,
      correct_answer_index: correctIndex,
      topic: inferTopic(question),
      reference: "Carrington Drone Exam Prep",
    });
    i = j;
  }

  const uniqueByQuestion = new Map();
  for (const row of extracted) {
    const key = row.question.toLowerCase();
    if (!uniqueByQuestion.has(key)) uniqueByQuestion.set(key, row);
  }

  return Array.from(uniqueByQuestion.values()).map((row, index) => ({
    id: index + 1,
    question: row.question,
    options: row.options,
    correct_answer_index: row.correct_answer_index,
    topic: row.topic,
    reference: row.reference,
    faa_citation: null,
    confirmed_test_eligible: false,
    image_required: false,
    image_url: null,
    image_description: null,
  }));
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Carrington source not found: ${SOURCE_PATH}`);
    process.exit(1);
  }
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const questions = extractQuestions(source);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(questions, null, 2) + "\n");
  console.log(`Extracted ${questions.length} Carrington questions -> ${OUTPUT_PATH}`);
}

main();
