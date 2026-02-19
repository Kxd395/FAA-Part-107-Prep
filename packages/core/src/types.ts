// ============================================================
// Part 107 Exam Prep — Core Types
// Shared between Next.js (web) and SwiftUI (native) via JSON
// ============================================================

export type OptionId = "A" | "B" | "C" | "D";

/** Answer option (A, B, C, or D depending on source) */
export interface QuestionOption {
  id: OptionId;
  text: string;
}

/** A single exam prep question */
export interface Question {
  id: string;
  category: Category;
  subcategory: string;
  question_text: string;
  figure_reference: string | null;
  image_ref?: string | null;
  figure_text?: string | null;
  options: QuestionOption[];
  correct_option_id: OptionId;
  explanation_correct: string;
  explanation_distractors: Partial<Record<OptionId, string>>;
  citation: string;
  difficulty_level: 1 | 2 | 3;
  acs_code?: string;
  source_type?: string;
  source?: string;
  tags: string[];
  year_updated?: number;
}

/** All topic categories (maps to ACS areas) */
export type Category =
  | "Regulations"
  | "Airspace"
  | "Weather"
  | "Loading & Performance"
  | "Operations"
  | "Emergency Procedures"
  | "Crew Resource Management"
  | "Radio Communications"
  | "Airport Operations"
  | "Maintenance & Preflight"
  | "Physiology"
  | "Remote ID";

/** Quiz mode determines feedback behavior */
export type QuizMode = "study" | "exam";

/** Tracks a user's answer to a single question */
export interface UserAnswer {
  question_id: string;
  selected_option_id: OptionId;
  is_correct: boolean;
  time_spent_ms: number;
  flagged_for_review: boolean;
  timestamp: number;
}

/** A complete quiz session */
export interface QuizSession {
  id: string;
  mode: QuizMode;
  started_at: number;
  ended_at: number | null;
  time_limit_ms: number | null; // null for study mode (unlimited)
  questions: Question[];
  answers: Map<string, UserAnswer>; // question_id -> answer
  current_index: number;
  is_complete: boolean;
}

/** Results summary after a session ends */
export interface SessionResult {
  session_id: string;
  mode: QuizMode;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  score_percent: number;
  passed: boolean; // >= 70%
  total_time_ms: number;
  avg_time_per_question_ms: number;
  category_breakdown: CategoryScore[];
  weakest_categories: Category[];
  flagged_questions: string[];
}

/** Score breakdown per category */
export interface CategoryScore {
  category: Category;
  total: number;
  correct: number;
  percent: number;
}

/** User's overall progress across all sessions */
export interface UserProgress {
  total_sessions: number;
  total_questions_answered: number;
  overall_accuracy_percent: number;
  category_accuracy: Record<Category, { total: number; correct: number; percent: number }>;
  question_history: Record<string, QuestionHistory>; // question_id -> history
  weak_spots: Category[]; // auto-detected weak categories
  last_session_at: number | null;
  streak_days: number;
}

/** History for a single question (tracks repeat attempts) */
export interface QuestionHistory {
  question_id: string;
  times_seen: number;
  times_correct: number;
  last_seen_at: number;
  avg_time_ms: number;
  mastered: boolean; // correct 3+ times in a row
}

/** Configuration for generating a quiz */
export interface QuizConfig {
  mode: QuizMode;
  question_count: number;
  categories?: Category[]; // filter to specific topics
  difficulty?: (1 | 2 | 3)[]; // filter by difficulty
  focus_weak_spots?: boolean; // weight toward weak categories
  exclude_mastered?: boolean; // skip questions already mastered
  time_limit_ms?: number; // exam mode: 7,200,000 (2 hours)
}
