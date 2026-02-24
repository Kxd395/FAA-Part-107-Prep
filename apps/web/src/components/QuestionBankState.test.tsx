import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "./QuestionBankState";

describe("QuestionBankState", () => {
  it("renders loading state with polite live region", () => {
    render(<QuestionBankLoading label="Loading questions..." />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/Loading questions/i)).toBeInTheDocument();
  });

  it("renders error with assertive alert and retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<QuestionBankError error="network" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders warning with optional try-live action", async () => {
    const user = userEvent.setup();
    const onTryLive = vi.fn();
    const onClearSnapshot = vi.fn();
    render(
      <QuestionBankWarning
        warning="Using snapshot"
        snapshotInfo={{ updatedAt: "2026-02-24T00:00:00.000Z", ageMs: 90 * 60 * 1000 }}
        onTryLive={onTryLive}
        onClearSnapshot={onClearSnapshot}
      />
    );
    await user.click(screen.getByRole("button", { name: /Try Live Source/i }));
    await user.click(screen.getByRole("button", { name: /Clear Cached Snapshot/i }));
    expect(onTryLive).toHaveBeenCalledTimes(1);
    expect(onClearSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Cached snapshot age/i)).toBeInTheDocument();
  });
});
