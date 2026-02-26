import { userScopedStorageKey } from "./progressStorage";

export const QUESTION_COLLECTION_STORAGE_KEY = "part107_question_collections_v1";
export const BOOKMARK_COLLECTION_FILTER = "bookmarks";
export const ALL_COLLECTION_FILTER = "all";
export const MAX_COLLECTION_NAME_LENGTH = 40;
const MAX_CUSTOM_COLLECTIONS = 30;

export type QuestionCollectionFilter = typeof ALL_COLLECTION_FILTER | string;

export interface QuestionCollectionSummary {
  id: string;
  name: string;
  questionCount: number;
  system: boolean;
}

interface StoredQuestionCollection {
  id: string;
  name: string;
  questionIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredQuestionCollections {
  version: 2;
  bookmarks: string[];
  customCollections: StoredQuestionCollection[];
}

const DEFAULT_COLLECTIONS: StoredQuestionCollections = {
  version: 2,
  bookmarks: [],
  customCollections: [],
};

function isValidQuestionId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueQuestionIds(ids: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(ids).map((id) => id.trim()).filter((id) => id.length > 0)));
}

function normalizeCollectionId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "collection"
  );
}

function normalizeCollectionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return null;
  if (normalized.length > MAX_COLLECTION_NAME_LENGTH) {
    return normalized.slice(0, MAX_COLLECTION_NAME_LENGTH).trim();
  }
  return normalized;
}

function normalizeCustomCollection(
  input: unknown,
  nowIso: string
): StoredQuestionCollection | null {
  if (!isPlainObject(input)) return null;
  const id =
    typeof input.id === "string" && input.id.trim().length > 0
      ? normalizeCollectionId(input.id)
      : null;
  const name = normalizeCollectionName(input.name);
  if (!id || !name) return null;
  const questionIds = Array.isArray(input.questionIds)
    ? uniqueQuestionIds(input.questionIds.filter(isValidQuestionId))
    : [];
  const createdAt =
    typeof input.createdAt === "string" && input.createdAt.trim().length > 0
      ? input.createdAt
      : nowIso;
  const updatedAt =
    typeof input.updatedAt === "string" && input.updatedAt.trim().length > 0
      ? input.updatedAt
      : createdAt;
  return {
    id,
    name,
    questionIds,
    createdAt,
    updatedAt,
  };
}

function uniqueCustomCollections(
  collections: StoredQuestionCollection[]
): StoredQuestionCollection[] {
  const byId = new Map<string, StoredQuestionCollection>();
  for (const collection of collections) {
    if (collection.id === BOOKMARK_COLLECTION_FILTER || collection.id === ALL_COLLECTION_FILTER) {
      continue;
    }
    if (!byId.has(collection.id)) {
      byId.set(collection.id, collection);
      continue;
    }
    const existing = byId.get(collection.id)!;
    const mergedQuestionIds = uniqueQuestionIds([...existing.questionIds, ...collection.questionIds]);
    byId.set(collection.id, {
      ...existing,
      name: existing.name || collection.name,
      questionIds: mergedQuestionIds,
      createdAt: existing.createdAt || collection.createdAt,
      updatedAt: existing.updatedAt > collection.updatedAt ? existing.updatedAt : collection.updatedAt,
    });
  }
  return Array.from(byId.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_CUSTOM_COLLECTIONS);
}

function parseCollections(raw: string | null): StoredQuestionCollections {
  if (!raw) return DEFAULT_COLLECTIONS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return DEFAULT_COLLECTIONS;
    const nowIso = new Date().toISOString();
    const rawBookmarks = Array.isArray(parsed.bookmarks)
      ? parsed.bookmarks.filter(isValidQuestionId)
      : [];
    const rawCustomCollections = Array.isArray(parsed.customCollections)
      ? parsed.customCollections
      : [];
    const bookmarks = Array.isArray(parsed.bookmarks)
      ? uniqueQuestionIds(rawBookmarks)
      : [];
    const customCollections = uniqueCustomCollections(
      rawCustomCollections
        .map((collection) => normalizeCustomCollection(collection, nowIso))
        .filter((collection): collection is StoredQuestionCollection => !!collection)
    );
    return { version: 2, bookmarks, customCollections };
  } catch {
    return DEFAULT_COLLECTIONS;
  }
}

function writeCollections(userId: string, collections: StoredQuestionCollections): void {
  if (typeof window === "undefined") return;
  const nowIso = new Date().toISOString();
  localStorage.setItem(
    userScopedStorageKey(QUESTION_COLLECTION_STORAGE_KEY, userId),
    JSON.stringify({
      version: 2,
      bookmarks: uniqueQuestionIds(collections.bookmarks),
      customCollections: uniqueCustomCollections(collections.customCollections).map((collection) => ({
        ...collection,
        name: normalizeCollectionName(collection.name) ?? "Collection",
        createdAt: collection.createdAt || nowIso,
        updatedAt: collection.updatedAt || nowIso,
        questionIds: uniqueQuestionIds(collection.questionIds),
      })),
    })
  );
}

function readCollections(userId: string): StoredQuestionCollections {
  if (typeof window === "undefined") return DEFAULT_COLLECTIONS;
  return parseCollections(localStorage.getItem(userScopedStorageKey(QUESTION_COLLECTION_STORAGE_KEY, userId)));
}

function writeCustomCollection(
  userId: string,
  collectionId: string,
  updater: (
    existing: StoredQuestionCollection
  ) => StoredQuestionCollection | null
): boolean {
  const parsed = readCollections(userId);
  const index = parsed.customCollections.findIndex((collection) => collection.id === collectionId);
  if (index < 0) return false;
  const current = parsed.customCollections[index];
  const nextValue = updater(current);
  if (!nextValue) {
    const nextCollections = parsed.customCollections.filter((collection) => collection.id !== collectionId);
    writeCollections(userId, { ...parsed, customCollections: nextCollections });
    return true;
  }
  const nextCollections = [...parsed.customCollections];
  nextCollections[index] = nextValue;
  writeCollections(userId, { ...parsed, customCollections: nextCollections });
  return true;
}

function updateCollectionQuestionIds(
  userId: string,
  collectionId: string,
  updater: (currentIds: Set<string>) => Set<string>
): boolean {
  if (collectionId === BOOKMARK_COLLECTION_FILTER) {
    const next = updater(readBookmarkedQuestionIds(userId));
    writeBookmarkedQuestionIds(userId, next);
    return true;
  }
  if (collectionId === ALL_COLLECTION_FILTER) return false;
  return writeCustomCollection(userId, collectionId, (existing) => ({
    ...existing,
    questionIds: uniqueQuestionIds(updater(new Set(existing.questionIds))),
    updatedAt: new Date().toISOString(),
  }));
}

function normalizeCollectionFilterValue(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === BOOKMARK_COLLECTION_FILTER) return BOOKMARK_COLLECTION_FILTER;
  return normalizeCollectionId(trimmed);
}

function buildCollectionSummary(collection: StoredQuestionCollection): QuestionCollectionSummary {
  return {
    id: collection.id,
    name: collection.name,
    questionCount: collection.questionIds.length,
    system: false,
  };
}

export function readBookmarkedQuestionIds(userId: string): Set<string> {
  const parsed = readCollections(userId);
  return new Set(parsed.bookmarks);
}

export function writeBookmarkedQuestionIds(userId: string, questionIds: Iterable<string>): void {
  const parsed = readCollections(userId);
  writeCollections(userId, { ...parsed, bookmarks: uniqueQuestionIds(questionIds) });
}

export function toggleBookmarkedQuestion(userId: string, questionId: string): boolean {
  return toggleQuestionInCollection(userId, BOOKMARK_COLLECTION_FILTER, questionId);
}

export function listQuestionCollections(userId: string): QuestionCollectionSummary[] {
  const parsed = readCollections(userId);
  return [
    {
      id: BOOKMARK_COLLECTION_FILTER,
      name: "Bookmarks",
      questionCount: parsed.bookmarks.length,
      system: true,
    },
    ...parsed.customCollections.map(buildCollectionSummary),
  ];
}

export function readQuestionCollectionQuestionIds(
  userId: string,
  collectionId: string
): Set<string> {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  if (normalizedCollectionId === ALL_COLLECTION_FILTER) return new Set();
  if (normalizedCollectionId === BOOKMARK_COLLECTION_FILTER) {
    return readBookmarkedQuestionIds(userId);
  }
  const parsed = readCollections(userId);
  const custom = parsed.customCollections.find((collection) => collection.id === normalizedCollectionId);
  return new Set(custom?.questionIds ?? []);
}

export function hasQuestionCollection(userId: string, collectionId: string): boolean {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  if (normalizedCollectionId === ALL_COLLECTION_FILTER) return true;
  return listQuestionCollections(userId).some((collection) => collection.id === normalizedCollectionId);
}

export function createQuestionCollection(
  userId: string,
  name: string
): QuestionCollectionSummary | null {
  const normalizedName = normalizeCollectionName(name);
  if (!normalizedName) return null;
  const parsed = readCollections(userId);
  if (parsed.customCollections.length >= MAX_CUSTOM_COLLECTIONS) return null;
  const existingIds = new Set(parsed.customCollections.map((collection) => collection.id));
  const baseId = normalizeCollectionId(normalizedName);
  let nextId = baseId;
  let suffix = 2;
  while (existingIds.has(nextId) || nextId === BOOKMARK_COLLECTION_FILTER || nextId === ALL_COLLECTION_FILTER) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const nowIso = new Date().toISOString();
  const nextCollection: StoredQuestionCollection = {
    id: nextId,
    name: normalizedName,
    questionIds: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  writeCollections(userId, {
    ...parsed,
    customCollections: [...parsed.customCollections, nextCollection],
  });
  return buildCollectionSummary(nextCollection);
}

export function renameQuestionCollection(
  userId: string,
  collectionId: string,
  nextName: string
): boolean {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  if (
    normalizedCollectionId === BOOKMARK_COLLECTION_FILTER ||
    normalizedCollectionId === ALL_COLLECTION_FILTER
  ) {
    return false;
  }
  const normalizedName = normalizeCollectionName(nextName);
  if (!normalizedName) return false;
  return writeCustomCollection(userId, normalizedCollectionId, (existing) => ({
    ...existing,
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteQuestionCollection(userId: string, collectionId: string): boolean {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  if (
    normalizedCollectionId === BOOKMARK_COLLECTION_FILTER ||
    normalizedCollectionId === ALL_COLLECTION_FILTER
  ) {
    return false;
  }
  return writeCustomCollection(userId, normalizedCollectionId, () => null);
}

export function addQuestionsToCollection(
  userId: string,
  collectionId: string,
  questionIds: Iterable<string>
): number {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  const incoming = uniqueQuestionIds(questionIds);
  if (incoming.length === 0) return 0;
  let added = 0;
  const updated = updateCollectionQuestionIds(userId, normalizedCollectionId, (currentIds) => {
    const next = new Set(currentIds);
    for (const questionId of incoming) {
      if (!next.has(questionId)) {
        added += 1;
      }
      next.add(questionId);
    }
    return next;
  });
  return updated ? added : 0;
}

export function removeQuestionsFromCollection(
  userId: string,
  collectionId: string,
  questionIds: Iterable<string>
): number {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  const removals = new Set(uniqueQuestionIds(questionIds));
  if (removals.size === 0) return 0;
  let removed = 0;
  const updated = updateCollectionQuestionIds(userId, normalizedCollectionId, (currentIds) => {
    const next = new Set(currentIds);
    for (const questionId of removals) {
      if (next.delete(questionId)) {
        removed += 1;
      }
    }
    return next;
  });
  return updated ? removed : 0;
}

export function toggleQuestionInCollection(
  userId: string,
  collectionId: string,
  questionId: string
): boolean {
  const normalizedCollectionId = normalizeCollectionFilterValue(collectionId);
  const normalizedQuestionId = questionId.trim();
  if (!normalizedQuestionId) return false;
  let isPresent = false;
  const updated = updateCollectionQuestionIds(userId, normalizedCollectionId, (currentIds) => {
    const next = new Set(currentIds);
    if (next.has(normalizedQuestionId)) {
      next.delete(normalizedQuestionId);
      isPresent = false;
    } else {
      next.add(normalizedQuestionId);
      isPresent = true;
    }
    return next;
  });
  return updated ? isPresent : false;
}

export function normalizeQuestionCollectionFilter(
  value: string | null | undefined
): QuestionCollectionFilter {
  if (!value) return ALL_COLLECTION_FILTER;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized === ALL_COLLECTION_FILTER) return ALL_COLLECTION_FILTER;
  if (normalized === BOOKMARK_COLLECTION_FILTER) return BOOKMARK_COLLECTION_FILTER;
  return normalizeCollectionId(normalized);
}
