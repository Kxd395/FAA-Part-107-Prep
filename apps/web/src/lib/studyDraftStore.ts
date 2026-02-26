import type { QuestionTypeProfile, StudySessionSnapshot, Question } from "@part107/core";
import { LOCAL_USER_ID } from "./analyticsTaxonomy";
import { userScopedStorageKey } from "./progressStorage";

const STORAGE_KEY = "part107_study_draft_v1";

export interface StudyDraft {
  version: 1;
  updatedAt: string;
  selectedQuestionType: QuestionTypeProfile;
  session: StudySessionSnapshot<Question>;
}

export function loadStudyDraft(userId: string = LOCAL_USER_ID): StudyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(userScopedStorageKey(STORAGE_KEY, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyDraft;
    if (!parsed || parsed.version !== 1) return null;
    if (!parsed.session || !Array.isArray(parsed.session.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudyDraft(draft: StudyDraft, userId: string = LOCAL_USER_ID): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userScopedStorageKey(STORAGE_KEY, userId), JSON.stringify(draft));
}

export function clearStudyDraft(userId: string = LOCAL_USER_ID): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(userScopedStorageKey(STORAGE_KEY, userId));
}

