import { useCallback, useMemo, useState } from "react";
import type { ProgressQuestionResult } from "./progress";
import { filterQuestionsByCategory, normalizeCategory, shuffleQuestions, type StudyCategory } from "./quiz";
import type { OptionId, Question } from "./types";

export type StudyAnswerState = "unanswered" | "correct" | "incorrect";

export interface UseStudySessionOptions<Q extends Question = Question> {
  allQuestions: readonly Q[];
  initialCategory?: StudyCategory;
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
  sessionStartTime: number;
  questionResults: ProgressQuestionResult[];
  progressPercent: number;
  startQuiz: (categoryInput?: string | StudyCategory) => void;
  answerQuestion: (optionId: OptionId) => void;
  nextQuestion: () => void;
  restartQuiz: () => void;
  resetToSetup: () => void;
}

export function useStudySession<Q extends Question = Question>({
  allQuestions,
  initialCategory = "All",
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

  const startQuiz = useCallback(
    (categoryInput?: string | StudyCategory) => {
      const normalized = normalizeCategory(categoryInput ?? selectedCategory) ?? "All";
      const filtered = filterQuestionsByCategory(allQuestions, normalized) as Q[];

      setSelectedCategory(normalized);
      setQuestions(shuffleQuestions(filtered));
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerState("unanswered");
      setScore({ correct: 0, total: 0 });
      setSessionStartTime(Date.now());
      setQuestionResults([]);
      setQuizStarted(true);
    },
    [allQuestions, selectedCategory]
  );

  const currentQuestion = useMemo(() => {
    if (!quizStarted) return null;
    if (currentIndex >= questions.length) return null;
    return questions[currentIndex] ?? null;
  }, [currentIndex, questions, quizStarted]);

  const answerQuestion = useCallback(
    (optionId: OptionId) => {
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
    },
    [answerState, currentQuestion]
  );

  const nextQuestion = useCallback(() => {
    if (questions.length === 0) return;

    setSelectedOption(null);
    setAnswerState("unanswered");
    setCurrentIndex((prev) => (prev < questions.length - 1 ? prev + 1 : questions.length));
  }, [questions.length]);

  const resetToSetup = useCallback(() => {
    setQuizStarted(false);
  }, []);

  const restartQuiz = useCallback(() => {
    startQuiz(selectedCategory);
  }, [selectedCategory, startQuiz]);

  const isComplete = quizStarted && questions.length > 0 && currentIndex >= questions.length;
  const progressPercent =
    questions.length > 0
      ? Math.min(100, ((Math.min(currentIndex + 1, questions.length)) / questions.length) * 100)
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
    sessionStartTime,
    questionResults,
    progressPercent,
    startQuiz,
    answerQuestion,
    nextQuestion,
    restartQuiz,
    resetToSetup,
  };
}
