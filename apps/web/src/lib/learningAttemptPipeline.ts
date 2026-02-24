import type { OptionId, Question } from "@part107/core";
import type { AttemptMode } from "./attemptEventStore";
import type { LearningEventMode } from "./analyticsTaxonomy";

interface AdaptiveRecorder {
  recordAnswer: (
    question: Question,
    isCorrect: boolean,
    answeredAtMs?: number,
    context?: {
      mode?: AttemptMode;
      selectedOptionId?: OptionId | null;
      responseTimeMs?: number | null;
      quizId?: string | null;
      confidence?: 1 | 2 | 3 | 4 | 5 | null;
    }
  ) => void;
}

interface EventLogger {
  logEvent: (event: {
    type: "answer_submitted";
    mode: LearningEventMode;
    questionId?: string;
    category?: string;
    subcategory?: string;
    selectedOption?: OptionId | null;
    correctOption?: OptionId | null;
    isCorrect?: boolean;
    questionTypeProfile?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) => void;
}

export interface RecordLearningAttemptParams {
  adaptive: AdaptiveRecorder;
  events: EventLogger;
  question: Question;
  learningMode: LearningEventMode;
  attemptMode: AttemptMode;
  isCorrect: boolean;
  selectedOptionId: OptionId | null;
  responseTimeMs: number;
  quizId?: string | null;
  confidence?: 1 | 2 | 3 | 4 | 5 | null;
  questionTypeProfile?: string;
  metadata?: Record<string, string | number | boolean | null>;
  persistAdaptive?: boolean;
}

export function recordLearningAttempt({
  adaptive,
  events,
  question,
  learningMode,
  attemptMode,
  isCorrect,
  selectedOptionId,
  responseTimeMs,
  quizId = null,
  confidence = null,
  questionTypeProfile,
  metadata,
  persistAdaptive = true,
}: RecordLearningAttemptParams): void {
  const answeredAtMs = Date.now();
  if (persistAdaptive) {
    adaptive.recordAnswer(question, isCorrect, answeredAtMs, {
      mode: attemptMode,
      selectedOptionId,
      responseTimeMs,
      quizId,
      confidence,
    });
  }

  events.logEvent({
    type: "answer_submitted",
    mode: learningMode,
    questionId: question.id,
    category: question.category,
    subcategory: question.subcategory,
    selectedOption: selectedOptionId,
    correctOption: question.correct_option_id,
    isCorrect,
    questionTypeProfile,
    metadata: {
      confidence,
      responseTimeMs,
      ...(metadata ?? {}),
    },
  });
}
