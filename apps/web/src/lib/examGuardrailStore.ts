import { userScopedStorageKey } from "./progressStorage";

export const EXAM_STRICT_CONFIRMED_STORAGE_KEY = "part107_exam_strict_confirmed_v1";

export function readExamStrictConfirmedOnly(userId: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(userScopedStorageKey(EXAM_STRICT_CONFIRMED_STORAGE_KEY, userId));
  return raw === "1";
}

export function writeExamStrictConfirmedOnly(userId: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    userScopedStorageKey(EXAM_STRICT_CONFIRMED_STORAGE_KEY, userId),
    enabled ? "1" : "0"
  );
}
