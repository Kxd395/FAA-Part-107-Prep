import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeRemainingTime,
  normalizeCategory,
  type StudyCategory,
} from "./quiz";
import { normalizeQuestionTypeProfile, type QuestionTypeProfile } from "./questionType";
import {
  buildExamRun,
  type ExamRunSettings,
} from "./examBuilder";
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
  questionTypeProfile: QuestionTypeProfile;
  questionCount: number;
  timeLimitMs: number;
  invalidCategory: boolean;
  invalidQuestionType: boolean;
}

export interface UseExamSessionOptions<Q extends Question = Question> {
  allQuestions: readonly Q[];
  passPercent?: number;
  initialQuestionTypeProfile?: QuestionTypeProfile;
  adaptive?: Parameters<typeof buildExamRun<Q>>[0]["adaptive"];
}

export interface UseExamSessionResult<Q extends Question = Question> {
  phase: ExamPhase;
  examCategory: StudyCategory;
  questionTypeProfile: QuestionTypeProfile;
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
  startExam: (
    categoryInput?: string | StudyCategory,
    questionTypeInput?: string | QuestionTypeProfile,
    runSettings?: ExamRunSettings
  ) => boolean;
  selectAnswer: (optionId: OptionId) => void;
  toggleFlagCurrent: () => void;
  submitExam: () => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  getSetupPreview: (
    categoryInput?: string | null,
    questionTypeInput?: string | QuestionTypeProfile | null,
    runSettings?: ExamRunSettings
  ) => ExamSetupPreview;
  review: ExamReviewSummary<Q>;
}

export function useExamSession<Q extends Question = Question>({
  allQuestions,
  passPercent = 70,
  initialQuestionTypeProfile = "real_exam",
  adaptive,
}: UseExamSessionOptions<Q>): UseExamSessionResult<Q> {
  const [phase, setPhase] = useState<ExamPhase>("setup");
  const [examCategory, setExamCategory] = useState<StudyCategory>("All");
  const [questionTypeProfile, setQuestionTypeProfile] = useState<QuestionTypeProfile>(
    initialQuestionTypeProfile
  );
  const [questions, setQuestions] = useState<Q[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, OptionId>>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState(0);
  const [timeLimitMs, setTimeLimitMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startExam = useCallback(
    (
      categoryInput?: string | StudyCategory,
      questionTypeInput?: string | QuestionTypeProfile,
      runSettings?: ExamRunSettings
    ) => {
      const normalizedCategory = normalizeCategory(categoryInput ?? examCategory) ?? "All";
      const normalizedType =
        normalizeQuestionTypeProfile(questionTypeInput ?? questionTypeProfile) ?? "real_exam";
      const examRun = buildExamRun<Q>({
        allQuestions,
        categoryInput: normalizedCategory,
        questionTypeInput: normalizedType,
        runSettings,
        adaptive,
      });

      if (examRun.questions.length === 0) {
        setQuestions([]);
        setExamCategory(normalizedCategory);
        setQuestionTypeProfile(normalizedType);
        setPhase("setup");
        return false;
      }

      const now = Date.now();

      setExamCategory(normalizedCategory);
      setQuestionTypeProfile(normalizedType);
      setQuestions(examRun.questions);
      setCurrentIndex(0);
      setAnswers(new Map());
      setFlagged(new Set());
      setStartTime(now);
      setTimeLimitMs(examRun.timeLimitMs);
      setRemainingMs(examRun.timeLimitMs);
      setPhase("in-progress");
      return true;
    },
    [adaptive, allQuestions, examCategory, questionTypeProfile]
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
    (
      categoryInput?: string | null,
      questionTypeInput?: string | QuestionTypeProfile | null,
      runSettings?: ExamRunSettings
    ): ExamSetupPreview => {
      const preview = buildExamRun<Q>({
        allQuestions,
        categoryInput: categoryInput ?? examCategory,
        questionTypeInput: questionTypeInput ?? questionTypeProfile,
        runSettings,
        adaptive,
      });

      return {
        category: preview.category,
        questionTypeProfile: preview.questionTypeProfile,
        questionCount: preview.questions.length,
        timeLimitMs: preview.timeLimitMs,
        invalidCategory: preview.invalidCategory,
        invalidQuestionType: preview.invalidQuestionType,
      };
    },
    [adaptive, allQuestions, examCategory, questionTypeProfile]
  );

  const answeredCount = answers.size;
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return {
    phase,
    examCategory,
    questionTypeProfile,
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
