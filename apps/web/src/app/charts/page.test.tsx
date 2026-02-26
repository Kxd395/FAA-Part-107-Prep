import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChartsPage from "./page";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
}));

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "test-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: mocks.logEvent,
  }),
}));

describe("ChartsPage", () => {
  beforeEach(() => {
    mocks.logEvent.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders chart resources and logs page view", () => {
    const { container } = render(<ChartsPage />);

    expect(screen.getByRole("heading", { name: /Sectional Charts/i })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href^="/figures/figure-"]')).toHaveLength(6);
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "page_view",
        mode: "charts",
        metadata: { route: "/charts" },
      })
    );
  });

  it("logs figure and citation interactions", () => {
    const { container } = render(<ChartsPage />);

    const figureLink = container.querySelector('a[href="/figures/figure-20.png"]');
    expect(figureLink).toBeTruthy();
    fireEvent.click(figureLink as HTMLAnchorElement);

    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "link_opened",
        mode: "charts",
        metadata: expect.objectContaining({
          target: "figure_open",
          figure: 20,
        }),
      })
    );

    fireEvent.click(screen.getByRole("link", { name: /UAS ACS \(PDF\)/i }));
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "citation_clicked",
        mode: "charts",
        citationLabel: "uas_acs_pdf",
      })
    );
  });
});
