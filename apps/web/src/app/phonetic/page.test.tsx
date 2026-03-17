import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PhoneticPage from "./page";

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "local-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

describe("PhoneticPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("advances to the next card without leaking the answer side", async () => {
    const user = userEvent.setup();

    render(<PhoneticPage />);

    const card = screen.getByRole("button", { name: /Study A/i });
    expect(within(card).getByText(/^A$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^AL FAH$/i)).not.toBeInTheDocument();

    await user.click(card);
    const revealedCard = screen.getByRole("button", { name: /Study A/i });
    expect(within(revealedCard).getByText(/Alfa/i)).toBeInTheDocument();
    expect(within(revealedCard).getByText(/^AL FAH$/i)).toBeInTheDocument();

    await user.click(card);

    const nextCard = screen.getByRole("button", { name: /Study B/i });
    expect(nextCard).not.toBe(card);
    expect(within(nextCard).getByText(/^B$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^BRAH VOH$/i)).not.toBeInTheDocument();
  });
});
