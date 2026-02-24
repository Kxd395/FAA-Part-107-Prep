import type { OptionId, Question } from "@part107/core";

export interface QuestionApiResponse {
  questions: Question[];
  meta: {
    total: number;
    category: string;
    shuffled: boolean;
    limit: number | null;
    source: "remote" | "local";
  };
}

const OPTION_IDS: readonly OptionId[] = ["A", "B", "C", "D"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionId(value: unknown): value is OptionId {
  return typeof value === "string" && OPTION_IDS.includes(value as OptionId);
}

function isQuestionOption(value: unknown): value is { id: OptionId; text: string } {
  return (
    isRecord(value) &&
    isOptionId(value.id) &&
    typeof value.text === "string" &&
    value.text.trim().length > 0
  );
}

function isQuestionLike(value: unknown): value is Question {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return false;
  if (typeof value.category !== "string" || value.category.trim().length === 0) return false;
  if (typeof value.subcategory !== "string") return false;
  if (typeof value.question_text !== "string" || value.question_text.trim().length === 0) return false;
  if (!Array.isArray(value.options) || value.options.length < 2) return false;
  if (!value.options.every(isQuestionOption)) return false;
  if (!isOptionId(value.correct_option_id)) return false;
  if (typeof value.explanation_correct !== "string") return false;
  if (typeof value.citation !== "string") return false;
  if (![1, 2, 3].includes(Number(value.difficulty_level))) return false;
  if (!Array.isArray(value.tags)) return false;
  return true;
}

export function parseQuestionApiResponse(payload: unknown): QuestionApiResponse {
  if (!isRecord(payload)) {
    throw new Error("Invalid /api/questions payload: expected object");
  }

  if (!Array.isArray(payload.questions)) {
    throw new Error("Invalid /api/questions payload: questions must be an array");
  }

  if (!payload.questions.every(isQuestionLike)) {
    throw new Error("Invalid /api/questions payload: questions contain invalid entries");
  }

  const meta = payload.meta;
  if (!isRecord(meta)) {
    throw new Error("Invalid /api/questions payload: meta is required");
  }
  if (!["remote", "local"].includes(String(meta.source))) {
    throw new Error("Invalid /api/questions payload: meta.source must be remote or local");
  }
  if (typeof meta.total !== "number" || !Number.isFinite(meta.total)) {
    throw new Error("Invalid /api/questions payload: meta.total must be numeric");
  }
  if (typeof meta.category !== "string") {
    throw new Error("Invalid /api/questions payload: meta.category must be a string");
  }
  if (typeof meta.shuffled !== "boolean") {
    throw new Error("Invalid /api/questions payload: meta.shuffled must be boolean");
  }
  if (!(meta.limit === null || (typeof meta.limit === "number" && Number.isFinite(meta.limit)))) {
    throw new Error("Invalid /api/questions payload: meta.limit must be number|null");
  }

  return {
    questions: payload.questions as Question[],
    meta: {
      total: meta.total,
      category: meta.category,
      shuffled: meta.shuffled,
      limit: meta.limit as number | null,
      source: meta.source as "remote" | "local",
    },
  };
}

export function parseRemoteQuestionSourcePayload(payload: unknown): Question[] {
  if (Array.isArray(payload)) {
    if (!payload.every(isQuestionLike)) {
      throw new Error("Remote question source contains invalid question entries");
    }
    return payload as Question[];
  }

  if (isRecord(payload) && Array.isArray(payload.questions)) {
    if (!payload.questions.every(isQuestionLike)) {
      throw new Error("Remote question source contains invalid question entries");
    }
    return payload.questions as Question[];
  }

  throw new Error("Remote question source must be an array or an object with questions[]");
}
