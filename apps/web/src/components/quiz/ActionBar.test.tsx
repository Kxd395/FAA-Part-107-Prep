import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ActionBar from "./ActionBar";

describe("ActionBar", () => {
  it("renders spread layout by default", () => {
    render(
      <ActionBar>
        <button type="button">Left</button>
        <button type="button">Right</button>
      </ActionBar>
    );

    const container = screen.getByRole("button", { name: "Left" }).parentElement;
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("items-center");
    expect(container).toHaveClass("justify-between");
    expect(container).toHaveClass("gap-3");
  });

  it("supports cluster and text layouts", () => {
    const { rerender } = render(
      <ActionBar layout="cluster">
        <button type="button">One</button>
      </ActionBar>
    );

    let container = screen.getByRole("button", { name: "One" }).parentElement;
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("items-center");
    expect(container).not.toHaveClass("justify-between");
    expect(container).toHaveClass("gap-3");

    rerender(
      <ActionBar layout="text">
        <button type="button">Two</button>
      </ActionBar>
    );

    container = screen.getByRole("button", { name: "Two" }).parentElement;
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("justify-between");
    expect(container).toHaveClass("text-sm");
  });
});
