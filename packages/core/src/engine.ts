// ============================================================
// Part 107 Exam Prep — Quiz Engine
// Handles session creation, answer validation, scoring, and
// the study/exam mode logic flow
// ============================================================

import type {
  Question,
  QuizConfig,
  QuizSession,
  UserAnswer,
  SessionResult,
  CategoryScore,
  Category,
  OptionId,
} from "./types";

/** Default exam configuration (mirrors real FAA Part 107 exam) */
export const EXAM_DEFAULTS = {
  TOTAL_QUESTIONS: 60,
  TIME_LIMIT_MS: 2 * 60 * 60 * 1000, // 2 hours
  PASSING_PERCENT: 70,
  PASSING_COUNT: 42,
} as const;

/** Generate a unique session ID */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Select questions for a quiz based on the config.
 * Handles filtering, shuffling, and weak-spot weighting.
 */
export function selectQuestions(
  allQuestions: Question[],
  config: QuizConfig,
  weakSpots?: Category[]
): Question[] {
  let pool = [...allQuestions];

  // Filter by category if specified
  if (config.categories && config.categories.length > 0) {
    pool = pool.filter((q) => config.categories!.includes(q.category));
  }

  // Filter by difficulty if specified
  if (config.difficulty && config.difficulty.length > 0) {
    pool = pool.filter((q) => config.difficulty!.includes(q.difficulty_level));
  }

  // Weight toward weak spots if requested
  if (config.focus_weak_spots && weakSpots && weakSpots.length > 0) {
    const weakQuestions = pool.filter((q) => weakSpots.includes(q.category));
    const otherQuestions = pool.filter((q) => !weakSpots.includes(q.category));

    // 70% weak spot questions, 30% other — if available
    const weakCount = Math.min(
      Math.floor(config.question_count * 0.7),
      weakQuestions.length
    );
    const otherCount = Math.min(
      config.question_count - weakCount,
      otherQuestions.length
    );

    pool = [
      ...shuffleArray(weakQuestions).slice(0, weakCount),
      ...shuffleArray(otherQuestions).slice(0, otherCount),
    ];
  }

  // Shuffle and take the requested count
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, Math.min(config.question_count, shuffled.length));
}

/** Fisher-Yates shuffle */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Create a new quiz session.
 */
export function createSession(
  questions: Question[],
  config: QuizConfig
): QuizSession {
  return {
    id: generateSessionId(),
    mode: config.mode,
    started_at: Date.now(),
    ended_at: null,
    time_limit_ms: config.mode === "exam" ? (config.time_limit_ms ?? EXAM_DEFAULTS.TIME_LIMIT_MS) : null,
    questions,
    answers: new Map(),
    current_index: 0,
    is_complete: false,
  };
}

/**
 * Submit an answer for the current question.
 * Returns the UserAnswer with validation.
 */
export function submitAnswer(
  session: QuizSession,
  questionId: string,
  selectedOptionId: OptionId,
  timeSpentMs: number,
  flagged: boolean = false
): UserAnswer {
  const question = session.questions.find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`Question ${questionId} not found in session`);
  }

  const answer: UserAnswer = {
    question_id: questionId,
    selected_option_id: selectedOptionId,
    is_correct: selectedOptionId === question.correct_option_id,
    time_spent_ms: timeSpentMs,
    flagged_for_review: flagged,
    timestamp: Date.now(),
  };

  session.answers.set(questionId, answer);
  return answer;
}

/**
 * Get feedback for a wrong answer (Study Mode).
 * Returns the explanation for the correct answer + why the distractor was wrong.
 */
export function getAnswerFeedback(
  question: Question,
  selectedOptionId: OptionId
): {
  is_correct: boolean;
  correct_answer: string;
  correct_explanation: string;
  distractor_explanation: string | null;
  citation: string;
} {
  const isCorrect = selectedOptionId === question.correct_option_id;
  const correctOption = question.options.find(
    (o) => o.id === question.correct_option_id
  )!;

  return {
    is_correct: isCorrect,
    correct_answer: `${correctOption.id}. ${correctOption.text}`,
    correct_explanation: question.explanation_correct,
    distractor_explanation: isCorrect
      ? null
      : question.explanation_distractors[selectedOptionId] ?? null,
    citation: question.citation,
  };
}

/**
 * Navigate to a specific question (for "Mark for Review" navigation).
 */
export function goToQuestion(session: QuizSession, index: number): Question | null {
  if (index < 0 || index >= session.questions.length) return null;
  session.current_index = index;
  return session.questions[index];
}

/** Move to next question */
export function nextQuestion(session: QuizSession): Question | null {
  return goToQuestion(session, session.current_index + 1);
}

/** Move to previous question */
export function previousQuestion(session: QuizSession): Question | null {
  return goToQuestion(session, session.current_index - 1);
}

/** Toggle flag for review on current question */
export function toggleFlag(session: QuizSession, questionId: string): void {
  const answer = session.answers.get(questionId);
  if (answer) {
    answer.flagged_for_review = !answer.flagged_for_review;
  }
}

/**
 * Check if the exam timer has expired.
 */
export function isTimeExpired(session: QuizSession): boolean {
  if (!session.time_limit_ms) return false;
  const elapsed = Date.now() - session.started_at;
  return elapsed >= session.time_limit_ms;
}

/** Get remaining time in ms */
export function getRemainingTime(session: QuizSession): number | null {
  if (!session.time_limit_ms) return null;
  const elapsed = Date.now() - session.started_at;
  return Math.max(0, session.time_limit_ms - elapsed);
}

/**
 * Complete a session and calculate results.
 */
export function completeSession(session: QuizSession): SessionResult {
  session.is_complete = true;
  session.ended_at = Date.now();

  const totalQuestions = session.questions.length;
  let correctCount = 0;
  let totalTimeMs = 0;
  const categoryMap = new Map<Category, { total: number; correct: number }>();
  const flaggedQuestions: string[] = [];

  // Process all questions
  for (const question of session.questions) {
    const cat = question.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, correct: 0 });
    }
    const catScore = categoryMap.get(cat)!;
    catScore.total++;

    const answer = session.answers.get(question.id);
    if (answer) {
      totalTimeMs += answer.time_spent_ms;
      if (answer.is_correct) {
        correctCount++;
        catScore.correct++;
      }
      if (answer.flagged_for_review) {
        flaggedQuestions.push(question.id);
      }
    }
  }

  const incorrectCount = session.answers.size - correctCount;
  const unansweredCount = totalQuestions - session.answers.size;
  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Build category breakdown
  const categoryBreakdown: CategoryScore[] = [];
  for (const [category, score] of categoryMap) {
    categoryBreakdown.push({
      category,
      total: score.total,
      correct: score.correct,
      percent: score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0,
    });
  }

  // Sort by worst performance first
  categoryBreakdown.sort((a, b) => a.percent - b.percent);

  // Identify weak categories (below 70%)
  const weakestCategories = categoryBreakdown
    .filter((c) => c.percent < EXAM_DEFAULTS.PASSING_PERCENT && c.total >= 2)
    .map((c) => c.category);

  return {
    session_id: session.id,
    mode: session.mode,
    total_questions: totalQuestions,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    score_percent: scorePercent,
    passed: scorePercent >= EXAM_DEFAULTS.PASSING_PERCENT,
    total_time_ms: totalTimeMs,
    avg_time_per_question_ms:
      session.answers.size > 0 ? Math.round(totalTimeMs / session.answers.size) : 0,
    category_breakdown: categoryBreakdown,
    weakest_categories: weakestCategories,
    flagged_questions: flaggedQuestions,
  };
}

/**
 * Detect weak spots from cumulative user history.
 * A category is "weak" if accuracy is below 70% with at least 5 questions attempted.
 */
export function detectWeakSpots(
  categoryAccuracy: Record<string, { total: number; correct: number }>
): Category[] {
  const weakSpots: Category[] = [];
  for (const [category, stats] of Object.entries(categoryAccuracy)) {
    if (stats.total >= 5) {
      const percent = (stats.correct / stats.total) * 100;
      if (percent < EXAM_DEFAULTS.PASSING_PERCENT) {
        weakSpots.push(category as Category);
      }
    }
  }
  return weakSpots;
}
