import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
}));

vi.mock("../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "test-user",
}));

vi.mock("../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: mocks.logEvent,
  }),
}));

vi.mock("../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [
      { category: "Regulations" },
      { category: "Regulations" },
      { category: "Airspace" },
      { category: "Operations" },
    ],
  }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mocks.logEvent.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders hero and logs home page view", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /Pass Your/i })).toBeInTheDocument();
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "page_view",
        mode: "home",
        metadata: expect.objectContaining({ route: "/" }),
      })
    );
  });

  it("updates hero study/exam links when practice type changes", () => {
    render(<HomePage />);

    const practiceTypeSelect = screen.getByLabelText(/Practice Question Type/i);
    fireEvent.change(practiceTypeSelect, { target: { value: "weak_spots" } });

    const studyLink = screen.getByRole("link", { name: /Start Studying/i });
    const examLink = screen.getByRole("link", { name: /Take Practice Exam/i });
    const studyBookmarksLink = screen.getByRole("link", { name: /Study Bookmarks/i });
    const examBookmarksLink = screen.getByRole("link", { name: /Exam from Bookmarks/i });

    expect(studyLink.getAttribute("href")).toContain("/study?type=weak_spots");
    expect(examLink.getAttribute("href")).toContain("/exam?type=weak_spots");
    expect(studyBookmarksLink.getAttribute("href")).toContain(
      "/study?collection=bookmarks&type=weak_spots"
    );
    expect(examBookmarksLink.getAttribute("href")).toContain(
      "/exam?collection=bookmarks&type=weak_spots"
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "filter_changed",
        mode: "home",
        questionTypeProfile: "weak_spots",
      })
    );
  });

  it("renders dynamic live question count stat", () => {
    render(<HomePage />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/Live loaded question bank/i)).toBeInTheDocument();
  });

  it("hydrates preferred question type for active user", () => {
    localStorage.setItem("part107_default_question_type_v1:test-user", "weak_spots");
    render(<HomePage />);

    const studyLink = screen.getByRole("link", { name: /Start Studying/i });
    expect(studyLink.getAttribute("href")).toContain("/study?type=weak_spots");
  });

  it("applies preferred study/exam categories to hero links", () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/Default Study Category/i), {
      target: { value: "Airspace" },
    });
    fireEvent.change(screen.getByLabelText(/Default Exam Category/i), {
      target: { value: "Operations" },
    });

    const studyLink = screen.getByRole("link", { name: /Start Studying/i });
    const examLink = screen.getByRole("link", { name: /Take Practice Exam/i });
    expect(studyLink.getAttribute("href")).toContain("category=Airspace");
    expect(examLink.getAttribute("href")).toContain("category=Operations");
  });

  it("persists learn and flashcard default preferences from home controls", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /^15$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^30$/i }));

    const raw = localStorage.getItem("part107_learning_preferences_v1:test-user");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}") as {
      defaultLearnBatchSize?: number;
      defaultFlashcardDailyReviewTarget?: number;
    };
    expect(parsed.defaultLearnBatchSize).toBe(15);
    expect(parsed.defaultFlashcardDailyReviewTarget).toBe(30);
  });
});
