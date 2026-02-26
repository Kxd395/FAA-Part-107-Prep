import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canonicalQuestionKey,
  dedupeQuestions,
  selectAdaptiveQuestions,
  type AdaptiveQuizConfig,
  type UserQuestionStats,
} from "./adaptive";
import type { ProgressQuestionResult } from "./progress";
import { filterQuestionsByCategory, normalizeCategory, shuffleQuestions, type StudyCategory } from "./quiz";
import type { OptionId, Question } from "./types";
import type { AttemptConfidence } from "./grading";

export type StudyAnswerState = "unanswered" | "correct" | "incorrect";

export interface UseStudySessionOptions<Q extends Question = Question> {
  allQuestions: readonly Q[];
  initialCategory?: StudyCategory;
  adaptive?: {
    userId: string;
    userStatsByKey?: Record<string, UserQuestionStats>;
    config?: Partial<AdaptiveQuizConfig>;
    onQuestionEvaluated?: (payload: {
      question: Q;
      canonicalKey: string;
      selectedOption: OptionId;
      isCorrect: boolean;
      answeredAt: string;
      confidence?: AttemptConfidence | null;
    }) => void;
  };
}

export interface StudyScore {
  correct: number;
  total: number;
}

export interface UseStudySessionResult<Q extends Question = Question> {
  selectedCategory: StudyCategory;
  questions: Q[];
  currentIndex: number;
  currentQuestion: Q | null;
  selectedOption: OptionId | null;
  answerState: StudyAnswerState;
  score: StudyScore;
  quizStarted: boolean;
  isComplete: boolean;
  timedOut: boolean;
  isTimedDrill: boolean;
  timeLimitMs: number;
  remainingMs: number;
  sessionStartTime: number;
  questionResults: ProgressQuestionResult[];
  progressPercent: number;
  startQuiz: (
    categoryInput?: string | StudyCategory,
    options?: {
      questionLimit?: number | null;
      timeLimitMs?: number | null;
    }
  ) => void;
  answerQuestion: (
    optionId: OptionId,
    context?: {
      confidence?: AttemptConfidence | null;
    }
  ) => void;
  skipQuestion: () => void;
  nextQuestion: () => void;
  restartQuiz: () => void;
  resetToSetup: () => void;
  restoreQuiz: (snapshot: StudySessionSnapshot<Q>) => void;
}

export interface StudySessionSnapshot<Q extends Question = Question> {
  selectedCategory: StudyCategory;
  questions: Q[];
  currentIndex: number;
  selectedOption: OptionId | null;
  answerState: StudyAnswerState;
  score: StudyScore;
  sessionStartTime: number;
  questionResults: ProgressQuestionResult[];
  timeLimitMs: number;
  remainingMs: number;
  timedOut: boolean;
  lastStartOptions?: {
    questionLimit?: number | null;
    timeLimitMs?: number | null;
  };
}

export function useStudySession<Q extends Question = Question>({
  allQuestions,
  initialCategory = "All",
  adaptive,
}: UseStudySessionOptions<Q>): UseStudySessionResult<Q> {
  const [selectedCategory, setSelectedCategory] = useState<StudyCategory>(initialCategory);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<OptionId | null>(null);
  const [answerState, setAnswerState] = useState<StudyAnswerState>("unanswered");
  const [score, setScore] = useState<StudyScore>({ correct: 0, total: 0 });
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [questionResults, setQuestionResults] = useState<ProgressQuestionResult[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeLimitMs, setTimeLimitMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [lastStartOptions, setLastStartOptions] = useState<{
    questionLimit?: number | null;
    timeLimitMs?: number | null;
  }>({});

  const startQuiz = useCallback(
    (
      categoryInput?: string | StudyCategory,
      options?: {
        questionLimit?: number | null;
        timeLimitMs?: number | null;
      }
    ) => {
      const normalized = normalizeCategory(categoryInput ?? selectedCategory) ?? "All";
      const filtered = filterQuestionsByCategory(allQuestions, normalized) as Q[];
      const parsedLimit =
        typeof options?.questionLimit === "number" &&
        Number.isFinite(options.questionLimit) &&
        options.questionLimit > 0
          ? Math.floor(options.questionLimit)
          : null;
      const desiredCount = parsedLimit ? Math.min(parsedLimit, filtered.length) : filtered.length;

      let nextQuestions: Q[];
      if (adaptive?.userId) {
        nextQuestions = selectAdaptiveQuestions({
          userId: adaptive.userId,
          desiredQuizSize: desiredCount,
          fullQuestionBank: filtered,
          userStatsByKey: adaptive.userStatsByKey,
          config: adaptive.config,
        }).questions as Q[];
      } else {
        const deduped = dedupeQuestions(filtered);
        nextQuestions = shuffleQuestions(deduped.questions as Q[]).slice(0, desiredCount);
      }
      const parsedTimeLimitMs =
        typeof options?.timeLimitMs === "number" &&
        Number.isFinite(options.timeLimitMs) &&
        options.timeLimitMs > 0
          ? Math.floor(options.timeLimitMs)
          : 0;

      setSelectedCategory(normalized);
      setQuestions(nextQuestions);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerState("unanswered");
      setScore({ correct: 0, total: 0 });
      setSessionStartTime(Date.now());
      setQuestionResults([]);
      setQuizStarted(true);
      setTimeLimitMs(parsedTimeLimitMs);
      setRemainingMs(parsedTimeLimitMs);
      setTimedOut(false);
      setLastStartOptions({
        questionLimit: parsedLimit,
        timeLimitMs: parsedTimeLimitMs > 0 ? parsedTimeLimitMs : null,
      });
    },
    [adaptive, allQuestions, selectedCategory]
  );

  const currentQuestion = useMemo(() => {
    if (!quizStarted) return null;
    if (currentIndex >= questions.length) return null;
    return questions[currentIndex] ?? null;
  }, [currentIndex, questions, quizStarted]);

  const answerQuestion = useCallback(
    (
      optionId: OptionId,
      context?: {
        confidence?: AttemptConfidence | null;
      }
    ) => {
      if (answerState !== "unanswered" || !currentQuestion) return;

      const isCorrect = optionId === currentQuestion.correct_option_id;
      setSelectedOption(optionId);
      setAnswerState(isCorrect ? "correct" : "incorrect");
      setScore((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));

      setQuestionResults((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          userAnswer: optionId,
          correctAnswer: currentQuestion.correct_option_id,
          isCorrect,
          category: currentQuestion.category,
        },
      ]);

      if (adaptive?.onQuestionEvaluated) {
        const canonicalKey = canonicalQuestionKey(currentQuestion, {
          includeChoices: adaptive.config?.includeChoicesInCanonicalKey ?? true,
        });
        adaptive.onQuestionEvaluated({
          question: currentQuestion,
          canonicalKey,
          selectedOption: optionId,
          isCorrect,
          answeredAt: new Date().toISOString(),
          confidence: context?.confidence ?? null,
        });
      }
    },
    [adaptive, answerState, currentQuestion]
  );

  const nextQuestion = useCallback(() => {
    if (questions.length === 0) return;

    setSelectedOption(null);
    setAnswerState("unanswered");
    setCurrentIndex((prev) => (prev < questions.length - 1 ? prev + 1 : questions.length));
  }, [questions.length]);

  const skipQuestion = useCallback(() => {
    if (answerState !== "unanswered" || questions.length === 0) return;

    // If this is the last visible question, skipping ends the session.
    if (currentIndex >= questions.length - 1) {
      setSelectedOption(null);
      setAnswerState("unanswered");
      setCurrentIndex(questions.length);
      return;
    }

    // Move skipped question to the end so the user can return to it later.
    setQuestions((prev) => {
      if (currentIndex < 0 || currentIndex >= prev.length - 1) return prev;
      const next = [...prev];
      const [skipped] = next.splice(currentIndex, 1);
      if (!skipped) return prev;
      next.push(skipped);
      return next;
    });

    setSelectedOption(null);
    setAnswerState("unanswered");
  }, [answerState, currentIndex, questions.length]);

  const resetToSetup = useCallback(() => {
    setQuizStarted(false);
    setTimeLimitMs(0);
    setRemainingMs(0);
    setTimedOut(false);
  }, []);

  const restartQuiz = useCallback(() => {
    startQuiz(selectedCategory, lastStartOptions);
  }, [lastStartOptions, selectedCategory, startQuiz]);

  const restoreQuiz = useCallback((snapshot: StudySessionSnapshot<Q>) => {
    const safeQuestions = Array.isArray(snapshot.questions) ? snapshot.questions : [];
    const clampedIndex = Math.max(0, Math.min(snapshot.currentIndex, safeQuestions.length));
    const parsedTimeLimitMs =
      Number.isFinite(snapshot.timeLimitMs) && snapshot.timeLimitMs > 0
        ? Math.floor(snapshot.timeLimitMs)
        : 0;
    const parsedRemainingMs =
      parsedTimeLimitMs > 0 && Number.isFinite(snapshot.remainingMs)
        ? Math.max(0, Math.min(parsedTimeLimitMs, Math.floor(snapshot.remainingMs)))
        : 0;

    setSelectedCategory(snapshot.selectedCategory);
    setQuestions(safeQuestions);
    setCurrentIndex(clampedIndex);
    setSelectedOption(snapshot.selectedOption ?? null);
    setAnswerState(snapshot.answerState);
    setScore(snapshot.score);
    setSessionStartTime(snapshot.sessionStartTime);
    setQuestionResults(Array.isArray(snapshot.questionResults) ? snapshot.questionResults : []);
    setQuizStarted(true);
    setTimeLimitMs(parsedTimeLimitMs);
    setRemainingMs(parsedRemainingMs);
    setTimedOut(Boolean(snapshot.timedOut));
    setLastStartOptions(snapshot.lastStartOptions ?? {});
  }, []);

  const isTimedDrill = quizStarted && timeLimitMs > 0;
  const isComplete = quizStarted && questions.length > 0 && currentIndex >= questions.length;
  useEffect(() => {
    if (!isTimedDrill || isComplete) return;

    const updateRemaining = () => {
      const nextRemaining = Math.max(0, timeLimitMs - (Date.now() - sessionStartTime));
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0) {
        setTimedOut(true);
        setSelectedOption(null);
        setAnswerState("unanswered");
        setCurrentIndex((prev) => (prev < questions.length ? questions.length : prev));
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1_000);
    return () => clearInterval(timer);
  }, [isComplete, isTimedDrill, questions.length, sessionStartTime, timeLimitMs]);

  const progressPercent =
    questions.length > 0
      ? Math.min(100, (Math.min(currentIndex + 1, questions.length) / questions.length) * 100)
      : 0;

  return {
    selectedCategory,
    questions,
    currentIndex,
    currentQuestion,
    selectedOption,
    answerState,
    score,
    quizStarted,
    isComplete,
    timedOut,
    isTimedDrill,
    timeLimitMs,
    remainingMs,
    sessionStartTime,
    questionResults,
    progressPercent,
    startQuiz,
    answerQuestion,
    skipQuestion,
    nextQuestion,
    restartQuiz,
    resetToSetup,
    restoreQuiz,
  };
}
