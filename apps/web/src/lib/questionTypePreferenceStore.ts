import type { QuestionTypeProfile } from "@part107/core";
import {
  normalizeSelectableQuestionTypeProfile,
  SELECTABLE_QUESTION_TYPE_PROFILES,
} from "./questionTypeOptions";
import { userScopedStorageKey } from "./progressStorage";

export const QUESTION_TYPE_PREFERENCE_STORAGE_KEY = "part107_default_question_type_v1";

export function readPreferredQuestionType(userId: string): QuestionTypeProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(userScopedStorageKey(QUESTION_TYPE_PREFERENCE_STORAGE_KEY, userId));
  return normalizeSelectableQuestionTypeProfile(raw);
}

export function writePreferredQuestionType(
  userId: string,
  profile: QuestionTypeProfile
): void {
  if (typeof window === "undefined") return;
  if (!SELECTABLE_QUESTION_TYPE_PROFILES.includes(profile)) return;
  localStorage.setItem(userScopedStorageKey(QUESTION_TYPE_PREFERENCE_STORAGE_KEY, userId), profile);
}
