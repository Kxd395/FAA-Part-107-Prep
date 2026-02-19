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
export type { QuestionTypeProfile, FilterQuestionsByTypeOptions } from "./questionType";
export type {
  CanonicalKeyOptions,
  UserQuestionStats,
  AdaptiveQuizConfig,
  DedupeQuestionsResult,
  AdaptiveSelectionInput,
  AdaptiveSelectionResult,
  UpdateUserQuestionStatsInput,
} from "./adaptive";
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
  REAL_EXAM_BLUEPRINT_TARGETS,
  shuffleQuestions,
  normalizeCategory,
  filterQuestionsByCategory,
  buildTimeLimitMs,
  computeRemainingTime,
  formatClockTime,
  buildExamQuestionSet,
  buildRealExamBlueprintQuestionSet,
} from "./quiz";
export {
  QUESTION_TYPE_PROFILES,
  QUESTION_TYPE_PROFILE_LABELS,
  normalizeQuestionTypeProfile,
  isAcsCodeMatchingQuestion,
  filterQuestionsByType,
} from "./questionType";

export { computeProgressStats } from "./progress";
export { parseCitation } from "./citations";
export {
  DEFAULT_ADAPTIVE_QUIZ_CONFIG,
  canonicalQuestionKey,
  dedupeQuestions,
  computeAccuracy,
  computeMasteryScore,
  isMastered,
  updateUserQuestionStats,
  selectAdaptiveQuestions,
} from "./adaptive";
export { useStudySession } from "./studySession";
export { useExamSession } from "./examSession";
