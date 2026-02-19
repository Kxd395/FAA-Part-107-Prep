// ============================================================
// Part 107 Exam Prep — Core Package Entry Point
// ============================================================

// Types
export type {
  Question,
  QuestionOption,
  Category,
  QuizMode,
  UserAnswer,
  QuizSession,
  SessionResult,
  CategoryScore,
  UserProgress,
  QuestionHistory,
  QuizConfig,
} from "./types";

// Engine
export {
  EXAM_DEFAULTS,
  selectQuestions,
  createSession,
  submitAnswer,
  getAnswerFeedback,
  goToQuestion,
  nextQuestion,
  previousQuestion,
  toggleFlag,
  isTimeExpired,
  getRemainingTime,
  completeSession,
  detectWeakSpots,
} from "./engine";
