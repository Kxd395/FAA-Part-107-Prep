import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfidenceSelector from "./ConfidenceSelector";

describe("ConfidenceSelector", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all confidence options and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ConfidenceSelector value={3} onChange={onChange} />);

    for (const value of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByRole("button", { name: value })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "5" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("highlights the selected confidence value", () => {
    render(<ConfidenceSelector value={2} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "2" })).toHaveClass("border-brand-400");
    expect(screen.getByRole("button", { name: "3" })).toHaveClass("border-brand-400/40");
  });
});
