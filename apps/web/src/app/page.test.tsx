import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
}));

vi.mock("../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: mocks.logEvent,
  }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mocks.logEvent.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders hero and logs home page view", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /Pass Your Part 107 Exam/i })).toBeInTheDocument();
    expect(screen.getByText(/Updated for 2026 FAA Rules/i)).toBeInTheDocument();
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "page_view",
        mode: "home",
        metadata: expect.objectContaining({ route: "/" }),
      })
    );
  });

  it("updates hero and topic links when practice type changes", () => {
    render(<HomePage />);

    const practiceTypeSelect = screen.getByLabelText(/Practice Question Type/i);
    fireEvent.change(practiceTypeSelect, { target: { value: "weak_spots" } });

    const studyLink = screen.getByRole("link", { name: /Start Studying/i });
    const examLink = screen.getByRole("link", { name: /Take Practice Exam/i });
    expect(studyLink.getAttribute("href")).toContain("/study?type=weak_spots");
    expect(examLink.getAttribute("href")).toContain("/exam?type=weak_spots");

    const topicStudyLinks = screen.getAllByRole("link", { name: "📖 Study" });
    const topicExamLinks = screen.getAllByRole("link", { name: "🎯 Test" });
    expect(topicStudyLinks[0]?.getAttribute("href")).toContain(
      "/study?category=Regulations&type=weak_spots"
    );
    expect(topicExamLinks[0]?.getAttribute("href")).toContain(
      "/exam?category=Regulations&type=weak_spots"
    );

    expect(screen.getByText(/Targets realistic MCQs you miss most often\./i)).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Selected: Weak Spots Only")
    ).toBeInTheDocument();

    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "filter_changed",
        mode: "home",
        questionTypeProfile: "weak_spots",
      })
    );
  });

  it("renders current static stats and feature links", () => {
    render(<HomePage />);

    expect(screen.getByText(/^85$/)).toBeInTheDocument();
    expect(screen.getByText(/^70%$/)).toBeInTheDocument();
    expect(screen.getByText(/^2 hrs$/)).toBeInTheDocument();
    expect(screen.getByText(/^2026$/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Study Mode/i })).toHaveAttribute("href", "/study");
    expect(screen.getByRole("link", { name: /Exam Mode/i })).toHaveAttribute("href", "/exam");
    expect(screen.getByRole("link", { name: /Flashcards/i })).toHaveAttribute("href", "/flashcards");
    expect(screen.getByRole("link", { name: /Learn Mode/i })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("link", { name: /Missed Questions/i })).toHaveAttribute("href", "/missed");
    expect(screen.getByRole("link", { name: /Sectional Charts/i })).toHaveAttribute("href", "/charts");
    expect(screen.getByRole("link", { name: /Smart Review/i })).toHaveAttribute(
      "href",
      "/study?type=weak_spots"
    );
  });

  it("logs navigation events when hero actions are clicked", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const startStudyLink = screen.getByRole("link", { name: /Start Studying/i });
    const takeExamLink = screen.getByRole("link", { name: /Take Practice Exam/i });
    startStudyLink.addEventListener("click", (event) => event.preventDefault());
    takeExamLink.addEventListener("click", (event) => event.preventDefault());

    await user.click(startStudyLink);
    await user.click(takeExamLink);

    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "link_opened",
        mode: "home",
        metadata: expect.objectContaining({
          target: "hero_start_study",
          href: "/study?type=confirmed_test",
        }),
      })
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "link_opened",
        mode: "home",
        metadata: expect.objectContaining({
          target: "hero_take_exam",
          href: "/exam?type=confirmed_test",
        }),
      })
    );
  });
});
