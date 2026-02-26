import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SessionButton from "./SessionButton";

describe("SessionButton", () => {
  it("applies the selected variant classes", () => {
    render(<SessionButton variant="brand-solid">Next</SessionButton>);
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("bg-brand-600");
  });

  it("forwards click handlers", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SessionButton variant="text-muted" onClick={onClick}>
        Skip
      </SessionButton>
    );

    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
