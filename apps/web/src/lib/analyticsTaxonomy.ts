export const ANALYTICS_EVENT_TYPES = [
  "question_shown",
  "answer_submitted",
  "question_skipped",
  "review_opened",
  "citation_clicked",
  "session_started",
  "session_saved",
  "session_resumed",
  "session_completed",
  "page_view",
  "control_clicked",
  "filter_changed",
  "tab_changed",
  "link_opened",
  "import_previewed",
  "import_applied",
] as const;

export type LearningEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_MODES = [
  "study",
  "exam",
  "learn",
  "flashcards",
  "home",
  "missed",
  "charts",
  "progress",
  "phonetic",
] as const;

export type LearningEventMode = (typeof ANALYTICS_MODES)[number];

export const LOCAL_USER_ID = "local-user";
