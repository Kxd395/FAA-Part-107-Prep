import type { QuestionTypeProfile } from "@part107/core";

const STORAGE_KEY = "part107_learn_draft_v1";

export type LearnDraftPhase = "teach" | "quiz" | "result";

export interface LearnDraftQuizResult {
  questionId: string;
  correct: boolean;
  userAnswer: string | null;
  correctAnswer: string;
  category: string;
}

export interface LearnDraft {
  version: 1;
  updatedAt: string;
  roundStartedAt: number;
  selectedQuestionType: QuestionTypeProfile;
  selectedCategory: string;
  batchSize: number;
  round: number;
  phase: LearnDraftPhase;
  batchIds: string[];
  teachIndex: number;
  quizOrderIds: string[];
  quizIndex: number;
  selectedAnswer: string | null;
  selectedConfidence?: 1 | 2 | 3 | 4 | 5 | null;
  showResult: boolean;
  quizResults: LearnDraftQuizResult[];
}

export function loadLearnDraft(): LearnDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LearnDraft;
    if (!parsed || parsed.version !== 1) return null;
    if (!Array.isArray(parsed.batchIds) || !Array.isArray(parsed.quizOrderIds)) return null;
    if (!Array.isArray(parsed.quizResults)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLearnDraft(draft: LearnDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearLearnDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
