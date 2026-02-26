import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfidencePanel from "./ConfidencePanel";

describe("ConfidencePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders title and optional hint content", () => {
    render(
      <ConfidencePanel
        title={
          <>
            Confidence for next answer: <code>3/5</code>
          </>
        }
        value={3}
        onChange={vi.fn()}
        hint={
          <>
            Tip: use <code>☑</code> for high confidence.
          </>
        }
      />
    );

    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
    expect(screen.getByText("3/5", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByText(/Tip: use/i)).toBeInTheDocument();
  });

  it("forwards confidence changes to onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConfidencePanel title="Confidence" value={2} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "5" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
