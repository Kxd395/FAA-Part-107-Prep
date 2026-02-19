// ============================================================
// Part 107 Exam Prep — Core Package Entry Point
// ============================================================

// Types
export type {
  OptionId,
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

export type {
  ProgressQuestionResult,
  ProgressSessionRecord,
  ProgressCategoryStat,
  ProgressStats,
} from "./progress";

export type { CitationReference } from "./citations";
export type { StudyCategory } from "./quiz";
export type {
  StudyAnswerState,
  UseStudySessionOptions,
  UseStudySessionResult,
  StudyScore,
} from "./studySession";
export type {
  ExamPhase,
  ExamReviewRow,
  ExamReviewSummary,
  ExamSetupPreview,
  UseExamSessionOptions,
  UseExamSessionResult,
} from "./examSession";

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

export {
  STUDY_CATEGORIES,
  FULL_EXAM_QUESTION_COUNT,
  FULL_EXAM_TIME_LIMIT_MS,
  shuffleQuestions,
  normalizeCategory,
  filterQuestionsByCategory,
  buildTimeLimitMs,
  computeRemainingTime,
  formatClockTime,
  buildExamQuestionSet,
} from "./quiz";

export { computeProgressStats } from "./progress";
export { parseCitation } from "./citations";
export { useStudySession } from "./studySession";
export { useExamSession } from "./examSession";
