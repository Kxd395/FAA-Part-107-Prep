import { readFileSync } from "node:fs";
import path from "node:path";
import type { OptionId, Question } from "@part107/core";

type RawQuestion = {
  id: number;
  question: string;
  options: string[];
  correct_answer_index: number;
  topic?: string;
  reference?: string;
  image_required?: boolean;
  image_url?: string | null;
  image_description?: string | null;
};

type RawImageNeed = {
  id: number;
  question: string;
  image_description: string;
};

function loadJsonFile<T>(absolutePath: string): T {
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

function toOptionId(index: number): OptionId {
  return (["A", "B", "C", "D"][index] ?? "A") as OptionId;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapTopicToCategory(topic: string): Question["category"] {
  const t = topic.toLowerCase();
  if (/weather|metar|taf|wind|cloud|visibility|icing|fog|thunderstorm|microburst/.test(t)) {
    return "Weather";
  }
  if (/airspace|sectional|chart|notam|class [bcdeg]|mtr|moa|prohibited|restricted/.test(t)) {
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

function deriveConceptKey(reference: string, topic: string): string {
  const cfr = reference.match(/14\s*cfr(?:\s*part)?\s*(?:§\s*)?(\d+(?:\.\d+)?)/i);
  if (cfr) {
    return `cfr:${cfr[1]}|${slug(topic || "general")}`;
  }
  const acs = reference.match(/\b(UA\.[IVX]+\.[A-Z]\.K\d+[A-Z]?)\b/i);
  if (acs) {
    return `acs:${acs[1].toUpperCase()}|${slug(topic || "general")}`;
  }
  return `p107:${slug(topic || "general")}|${slug(reference || "general")}`;
}

function normalizeImageRef(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function loadPart107QuestionBank(): Question[] {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const bankPath = path.join(repoRoot, "docs/ssot/review/part107_question_bank.json");
  const imageNeedPath = path.join(repoRoot, "docs/ssot/review/part107_images_needed.json");

  let bank: RawQuestion[] = [];
  let imageNeeds: RawImageNeed[] = [];
  try {
    bank = loadJsonFile<RawQuestion[]>(bankPath);
  } catch {
    return [];
  }
  try {
    imageNeeds = loadJsonFile<RawImageNeed[]>(imageNeedPath);
  } catch {
    imageNeeds = [];
  }

  const imageNeedById = new Map<number, RawImageNeed>(imageNeeds.map((row) => [row.id, row]));

  return bank
    .map((raw): Question | null => {
      if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 4) return null;
      const optionCount = raw.options.length;
      const boundedAnswerIndex =
        raw.correct_answer_index >= 0 && raw.correct_answer_index < optionCount ? raw.correct_answer_index : 0;
      const topic = raw.topic?.trim() || "General";
      const reference = raw.reference?.trim() || "Part 107 Question Bank";
      const imageNeed = imageNeedById.get(raw.id);
      const imageRef = normalizeImageRef(raw.image_url);
      const figureText =
        raw.image_required || imageNeed
          ? (imageNeed?.image_description ?? raw.image_description ?? "").trim() || null
          : null;

      return {
        id: `P107-${String(raw.id).padStart(3, "0")}`,
        category: mapTopicToCategory(topic),
        subcategory: topic,
        question_text: raw.question.trim(),
        figure_reference: null,
        image_ref: imageRef,
        figure_text: figureText,
        options: raw.options.map((opt, idx) => ({
          id: toOptionId(idx),
          text: String(opt).trim(),
        })),
        correct_option_id: toOptionId(boundedAnswerIndex),
        explanation_correct: `Answer sourced from ${reference}.`,
        explanation_distractors: {},
        citation: reference,
        difficulty_level: 2,
        source: "part107-question-bank",
        source_type: "resource_pack",
        tags: ["part107-bank", slug(topic)],
        concept_key: deriveConceptKey(reference, topic),
      };
    })
    .filter((q): q is Question => Boolean(q));
}

