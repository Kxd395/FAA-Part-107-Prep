import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dedupeQuestions,
  selectAdaptiveQuestions,
  type AdaptiveQuizConfig,
  type UserQuestionStats,
} from "./adaptive";
import {
  FULL_EXAM_QUESTION_COUNT,
  buildTimeLimitMs,
  computeRemainingTime,
  filterQuestionsByCategory,
  normalizeCategory,
  shuffleQuestions,
  type StudyCategory,
} from "./quiz";
import type { OptionId, Question } from "./types";

export type ExamPhase = "setup" | "in-progress" | "review";

export interface ExamReviewRow<Q extends Question = Question> {
  question: Q;
  userAnswer: OptionId | null;
  isCorrect: boolean;
}

export interface ExamReviewSummary<Q extends Question = Question> {
  rows: ExamReviewRow<Q>[];
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  totalTimeMs: number;
}

export interface ExamSetupPreview {
  category: StudyCategory;
  questionCount: number;
  timeLimitMs: number;
  invalidCategory: boolean;
}

export interface UseExamSessionOptions<Q extends Question = Question> {
  allQuestions: readonly Q[];
  passPercent?: number;
  adaptive?: {
    userId: string;
    userStatsByKey?: Record<string, UserQuestionStats>;
    config?: Partial<AdaptiveQuizConfig>;
  };
}

export interface UseExamSessionResult<Q extends Question = Question> {
  phase: ExamPhase;
  examCategory: StudyCategory;
  questions: Q[];
  currentIndex: number;
  currentQuestion: Q | null;
  answers: Map<string, OptionId>;
  flagged: Set<string>;
  startTime: number;
  timeLimitMs: number;
  remainingMs: number;
  answeredCount: number;
  currentAnswer: OptionId | null;
  progressPercent: number;
  startExam: (categoryInput?: string | StudyCategory) => boolean;
  selectAnswer: (optionId: OptionId) => void;
  toggleFlagCurrent: () => void;
  submitExam: () => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  getSetupPreview: (categoryInput?: string | null) => ExamSetupPreview;
  review: ExamReviewSummary<Q>;
}

export function useExamSession<Q extends Question = Question>({
  allQuestions,
  passPercent = 70,
  adaptive,
}: UseExamSessionOptions<Q>): UseExamSessionResult<Q> {
  const [phase, setPhase] = useState<ExamPhase>("setup");
  const [examCategory, setExamCategory] = useState<StudyCategory>("All");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, OptionId>>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState(0);
  const [timeLimitMs, setTimeLimitMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startExam = useCallback(
    (categoryInput?: string | StudyCategory) => {
      const normalized = normalizeCategory(categoryInput ?? examCategory) ?? "All";
      const filtered = filterQuestionsByCategory(allQuestions, normalized) as Q[];
      const deduped = dedupeQuestions(filtered);
      const targetCount =
        normalized === "All"
          ? Math.min(FULL_EXAM_QUESTION_COUNT, deduped.questions.length)
          : deduped.questions.length;

      let selectedQuestions: Q[];
      if (adaptive?.userId) {
        selectedQuestions = selectAdaptiveQuestions({
          userId: adaptive.userId,
          desiredQuizSize: targetCount,
          fullQuestionBank: filtered,
          userStatsByKey: adaptive.userStatsByKey,
          config: adaptive.config,
        }).questions as Q[];
      } else {
        selectedQuestions = shuffleQuestions(deduped.questions as Q[]).slice(0, targetCount);
      }

      if (selectedQuestions.length === 0) {
        setQuestions([]);
        setExamCategory("All");
        setPhase("setup");
        return false;
      }

      const now = Date.now();
      const nextTimeLimitMs = buildTimeLimitMs(selectedQuestions.length, normalized);

      setExamCategory(normalized);
      setQuestions(selectedQuestions);
      setCurrentIndex(0);
      setAnswers(new Map());
      setFlagged(new Set());
      setStartTime(now);
      setTimeLimitMs(nextTimeLimitMs);
      setRemainingMs(nextTimeLimitMs);
      setPhase("in-progress");
      return true;
    },
    [adaptive, allQuestions, examCategory]
  );

  useEffect(() => {
    if (phase !== "in-progress") return;

    timerRef.current = setInterval(() => {
      const nextRemaining = computeRemainingTime(startTime, timeLimitMs);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        setPhase("review");
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime, timeLimitMs]);

  const currentQuestion = useMemo(() => questions[currentIndex] ?? null, [currentIndex, questions]);
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) ?? null : null;

  const selectAnswer = useCallback(
    (optionId: OptionId) => {
      const question = questions[currentIndex];
      if (!question) return;

      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(question.id, optionId);
        return next;
      });
    },
    [currentIndex, questions]
  );

  const toggleFlagCurrent = useCallback(() => {
    const question = questions[currentIndex];
    if (!question) return;

    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  }, [currentIndex, questions]);

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      setCurrentIndex(index);
    },
    [questions.length]
  );

  const nextQuestion = useCallback(() => {
    setCurrentIndex((prev) => (prev < questions.length - 1 ? prev + 1 : prev));
  }, [questions.length]);

  const previousQuestion = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const submitExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("review");
  }, []);

  const review = useMemo<ExamReviewSummary<Q>>(() => {
    let correctCount = 0;
    const rows = questions.map((question) => {
      const userAnswer = answers.get(question.id) ?? null;
      const isCorrect = userAnswer === question.correct_option_id;
      if (isCorrect) correctCount++;
      return { question, userAnswer, isCorrect };
    });

    const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const totalTimeMs = Math.max(0, timeLimitMs - remainingMs);

    return {
      rows,
      correctCount,
      scorePercent,
      passed: scorePercent >= passPercent,
      totalTimeMs,
    };
  }, [answers, passPercent, questions, remainingMs, timeLimitMs]);

  const getSetupPreview = useCallback(
    (categoryInput?: string | null): ExamSetupPreview => {
      const parsed = normalizeCategory(categoryInput ?? examCategory);
      const category = parsed ?? "All";
      const invalidCategory = !!categoryInput && !parsed;

      const pool = filterQuestionsByCategory(allQuestions, category);
      const deduped = dedupeQuestions(pool);
      const targetCount =
        category === "All"
          ? Math.min(FULL_EXAM_QUESTION_COUNT, deduped.questions.length)
          : deduped.questions.length;

      const questionCount = adaptive?.userId
        ? selectAdaptiveQuestions({
            userId: adaptive.userId,
            desiredQuizSize: targetCount,
            fullQuestionBank: pool,
            userStatsByKey: adaptive.userStatsByKey,
            config: adaptive.config,
          }).questions.length
        : targetCount;

      const timeLimitMs = buildTimeLimitMs(questionCount, category);

      return {
        category,
        questionCount,
        timeLimitMs,
        invalidCategory,
      };
    },
    [adaptive, allQuestions, examCategory]
  );

  const answeredCount = answers.size;
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return {
    phase,
    examCategory,
    questions,
    currentIndex,
    currentQuestion,
    answers,
    flagged,
    startTime,
    timeLimitMs,
    remainingMs,
    answeredCount,
    currentAnswer,
    progressPercent,
    startExam,
    selectAnswer,
    toggleFlagCurrent,
    submitExam,
    goToQuestion,
    nextQuestion,
    previousQuestion,
    getSetupPreview,
    review,
  };
}
