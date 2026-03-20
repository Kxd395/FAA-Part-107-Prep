import {
  dedupeQuestions,
  selectAdaptiveQuestions,
  type AdaptiveQuizConfig,
  type UserQuestionStats,
} from "./adaptive";
import {
  filterQuestionsByType,
  normalizeQuestionTypeProfile,
  type QuestionTypeProfile,
} from "./questionType";
import {
  FULL_EXAM_QUESTION_COUNT,
  buildRealExamBlueprintQuestionSet,
  buildTimeLimitMs,
  filterQuestionsByCategory,
  normalizeCategory,
  shuffleQuestions,
  type StudyCategory,
} from "./quiz";
import type { Question } from "./types";

export interface ExamRunSettings {
  questionLimit?: number | null;
  timeLimitMs?: number | null;
}

export interface ParsedExamRunSettings {
  questionLimit: number | null;
  timeLimitMs: number | null;
}

export interface BuildExamRunOptions<Q extends Question = Question> {
  allQuestions: readonly Q[];
  categoryInput?: string | StudyCategory | null;
  questionTypeInput?: string | QuestionTypeProfile | null;
  runSettings?: ExamRunSettings;
  adaptive?: {
    userId: string;
    userStatsByKey?: Record<string, UserQuestionStats>;
    config?: Partial<AdaptiveQuizConfig>;
  };
}

export interface BuildExamRunResult<Q extends Question = Question> {
  category: StudyCategory;
  questionTypeProfile: QuestionTypeProfile;
  questions: Q[];
  timeLimitMs: number;
  invalidCategory: boolean;
  invalidQuestionType: boolean;
}

export function parseExamRunSettings(runSettings?: ExamRunSettings): ParsedExamRunSettings {
  const parsedQuestionLimit =
    typeof runSettings?.questionLimit === "number" &&
    Number.isFinite(runSettings.questionLimit) &&
    runSettings.questionLimit > 0
      ? Math.floor(runSettings.questionLimit)
      : null;
  const parsedTimeLimitMs =
    typeof runSettings?.timeLimitMs === "number" &&
    Number.isFinite(runSettings.timeLimitMs) &&
    runSettings.timeLimitMs > 0
      ? Math.floor(runSettings.timeLimitMs)
      : null;

  return {
    questionLimit: parsedQuestionLimit,
    timeLimitMs: parsedTimeLimitMs,
  };
}

export function buildExamRun<Q extends Question = Question>({
  allQuestions,
  categoryInput,
  questionTypeInput,
  runSettings,
  adaptive,
}: BuildExamRunOptions<Q>): BuildExamRunResult<Q> {
  const parsedCategory = normalizeCategory(categoryInput);
  const category = parsedCategory ?? "All";
  const invalidCategory = !!categoryInput && !parsedCategory;

  const parsedType = normalizeQuestionTypeProfile(questionTypeInput);
  const questionTypeProfile = parsedType ?? "real_exam";
  const invalidQuestionType = !!questionTypeInput && !parsedType;

  const parsedRunSettings = parseExamRunSettings(runSettings);
  const filteredByCategory = filterQuestionsByCategory(allQuestions, category) as Q[];
  const filteredByType = filterQuestionsByType(filteredByCategory, questionTypeProfile, {
    userStatsByKey: adaptive?.userStatsByKey,
    adaptiveConfig: adaptive?.config,
  }) as Q[];

  const deduped = dedupeQuestions(filteredByType);
  const useRealExamBlueprint = category === "All" && questionTypeProfile === "real_exam";
  const baseTargetCount =
    useRealExamBlueprint
      ? Math.min(FULL_EXAM_QUESTION_COUNT, deduped.questions.length)
      : category === "All"
        ? Math.min(FULL_EXAM_QUESTION_COUNT, deduped.questions.length)
        : deduped.questions.length;
  const targetCount = parsedRunSettings.questionLimit
    ? Math.min(baseTargetCount, parsedRunSettings.questionLimit)
    : baseTargetCount;

  let questions: Q[];
  if (useRealExamBlueprint) {
    questions = buildRealExamBlueprintQuestionSet(
      deduped.questions as Q[],
      FULL_EXAM_QUESTION_COUNT
    ).questions.slice(0, targetCount);
  } else if (adaptive?.userId) {
    questions = selectAdaptiveQuestions({
      userId: adaptive.userId,
      desiredQuizSize: targetCount,
      fullQuestionBank: filteredByType,
      userStatsByKey: adaptive.userStatsByKey,
      config: adaptive.config,
    }).questions as Q[];
  } else {
    questions = shuffleQuestions(deduped.questions as Q[]).slice(0, targetCount);
  }

  return {
    category,
    questionTypeProfile,
    questions,
    timeLimitMs: parsedRunSettings.timeLimitMs ?? buildTimeLimitMs(questions.length, category),
    invalidCategory,
    invalidQuestionType,
  };
}
