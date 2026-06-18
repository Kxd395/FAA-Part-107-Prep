import type { OptionId, Question } from "@part107/core";
import strictCarringtonBank from "../../../../../packages/content/knowledge/carrington_question_bank.strict.json";
import carringtonBank from "../../../../../docs/ssot/review/carrington_question_bank.json";

type RawQuestion = {
  id: number;
  question: string;
  options: string[];
  correct_answer_index: number;
  topic?: string;
  reference?: string;
  faa_citation?: string | null;
  confirmed_test_eligible?: boolean;
  image_required?: boolean;
  image_url?: string | null;
  image_description?: string | null;
};

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
  return `carrington:${slug(topic || "general")}|${slug(reference || "general")}`;
}

function normalizeImageRef(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function loadCarringtonQuestionBank(): Question[] {
  return normalizeCarringtonBank(carringtonBank as RawQuestion[], "carrington-question-bank");
}

export function loadCarringtonStrictQuestionBank(): Question[] {
  return normalizeCarringtonBank(
    strictCarringtonBank as RawQuestion[],
    "carrington-question-bank-strict"
  );
}

function normalizeCarringtonBank(bank: RawQuestion[], sourceName: string): Question[] {
  if (bank.length === 0) {
    return [];
  }

  return bank
    .map((raw): Question | null => {
      if (!Array.isArray(raw.options) || raw.options.length < 3 || raw.options.length > 4) return null;
      const optionCount = raw.options.length;
      const boundedAnswerIndex =
        raw.correct_answer_index >= 0 && raw.correct_answer_index < optionCount ? raw.correct_answer_index : 0;
      const topic = raw.topic?.trim() || "General";
      const reference = raw.reference?.trim() || "Carrington Drone Exam Prep";
      const explicitCitation = raw.faa_citation?.trim() || null;
      const confirmedEligible = raw.confirmed_test_eligible === true;
      const imageRef = normalizeImageRef(raw.image_url);
      const tags = ["carrington-bank", slug(topic)];
      if (confirmedEligible) {
        tags.push("confirmed-test-eligible");
      }

      return {
        id: `CAR-${String(raw.id).padStart(3, "0")}`,
        category: mapTopicToCategory(topic),
        subcategory: topic,
        question_text: raw.question.trim(),
        figure_reference: null,
        image_ref: imageRef,
        figure_text: raw.image_description?.trim() || null,
        options: raw.options.map((opt, idx) => ({
          id: toOptionId(idx),
          text: String(opt).trim(),
        })),
        correct_option_id: toOptionId(boundedAnswerIndex),
        explanation_correct: `Answer sourced from ${reference}.`,
        explanation_distractors: {},
        citation: explicitCitation || reference,
        difficulty_level: 2,
        source: sourceName,
        source_type: "resource_pack",
        tags,
        concept_key: deriveConceptKey(reference, topic),
      } as unknown as Question;
    })
    .filter((q): q is Question => Boolean(q));
}
