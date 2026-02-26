import { beforeEach, describe, expect, it } from "vitest";
import {
  addQuestionsToCollection,
  createQuestionCollection,
  deleteQuestionCollection,
  normalizeQuestionCollectionFilter,
  readQuestionCollectionQuestionIds,
  readBookmarkedQuestionIds,
  removeQuestionsFromCollection,
  renameQuestionCollection,
  listQuestionCollections,
  toggleBookmarkedQuestion,
  toggleQuestionInCollection,
  writeBookmarkedQuestionIds,
} from "./questionCollectionStore";

describe("questionCollectionStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads and writes bookmarks per user", () => {
    writeBookmarkedQuestionIds("pilot-a", ["Q-1", "Q-2", "Q-1"]);
    writeBookmarkedQuestionIds("pilot-b", ["Q-9"]);

    expect(Array.from(readBookmarkedQuestionIds("pilot-a")).sort()).toEqual(["Q-1", "Q-2"]);
    expect(Array.from(readBookmarkedQuestionIds("pilot-b"))).toEqual(["Q-9"]);
  });

  it("toggles bookmarked state", () => {
    expect(toggleBookmarkedQuestion("pilot-a", "Q-1")).toBe(true);
    expect(Array.from(readBookmarkedQuestionIds("pilot-a"))).toEqual(["Q-1"]);
    expect(toggleBookmarkedQuestion("pilot-a", "Q-1")).toBe(false);
    expect(Array.from(readBookmarkedQuestionIds("pilot-a"))).toEqual([]);
  });

  it("normalizes supported collection filters", () => {
    expect(normalizeQuestionCollectionFilter(undefined)).toBe("all");
    expect(normalizeQuestionCollectionFilter("")).toBe("all");
    expect(normalizeQuestionCollectionFilter("All")).toBe("all");
    expect(normalizeQuestionCollectionFilter("bookmarks")).toBe("bookmarks");
    expect(normalizeQuestionCollectionFilter("BOOKMARKS")).toBe("bookmarks");
    expect(normalizeQuestionCollectionFilter("custom")).toBe("custom");
    expect(normalizeQuestionCollectionFilter("My Focus List")).toBe("my-focus-list");
  });

  it("creates, renames, and deletes named collections per user", () => {
    const created = createQuestionCollection("pilot-a", "My Focus");
    expect(created).not.toBeNull();
    expect(created?.id).toBe("my-focus");

    const duplicate = createQuestionCollection("pilot-a", "My Focus");
    expect(duplicate?.id).toBe("my-focus-2");

    expect(renameQuestionCollection("pilot-a", "my-focus", "  Regulations Focus  ")).toBe(true);
    expect(deleteQuestionCollection("pilot-a", "my-focus-2")).toBe(true);

    const collections = listQuestionCollections("pilot-a");
    expect(collections).toEqual([
      expect.objectContaining({ id: "bookmarks", name: "Bookmarks", system: true }),
      expect.objectContaining({ id: "my-focus", name: "Regulations Focus", system: false }),
    ]);
  });

  it("adds/removes/toggles question IDs in named collections", () => {
    const collection = createQuestionCollection("pilot-a", "Targeted weak spots");
    expect(collection).not.toBeNull();

    expect(addQuestionsToCollection("pilot-a", collection!.id, ["Q-1", "Q-2", "Q-1"])).toBe(2);
    expect(Array.from(readQuestionCollectionQuestionIds("pilot-a", collection!.id)).sort()).toEqual([
      "Q-1",
      "Q-2",
    ]);

    expect(removeQuestionsFromCollection("pilot-a", collection!.id, ["Q-2", "Q-9"])).toBe(1);
    expect(Array.from(readQuestionCollectionQuestionIds("pilot-a", collection!.id))).toEqual(["Q-1"]);

    expect(toggleQuestionInCollection("pilot-a", collection!.id, "Q-3")).toBe(true);
    expect(toggleQuestionInCollection("pilot-a", collection!.id, "Q-1")).toBe(false);
    expect(Array.from(readQuestionCollectionQuestionIds("pilot-a", collection!.id)).sort()).toEqual([
      "Q-3",
    ]);
  });
});
