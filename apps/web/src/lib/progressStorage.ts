import { LOCAL_USER_ID } from "./analyticsTaxonomy";

export const PROGRESS_STORAGE_KEY = "part107_progress";
export const FLASHCARD_SR_STORAGE_KEY = "part107_flashcard_sr";
export const LEARN_DRAFT_STORAGE_KEY = "part107_learn_draft_v1";

export function normalizeUserId(userId: string): string {
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : LOCAL_USER_ID;
}

export function userScopedStorageKey(baseKey: string, userId: string): string {
  const normalizedUserId = normalizeUserId(userId);
  if (normalizedUserId === LOCAL_USER_ID) return baseKey;
  return `${baseKey}:${normalizedUserId}`;
}

export function progressStorageKey(userId: string): string {
  return userScopedStorageKey(PROGRESS_STORAGE_KEY, userId);
}
