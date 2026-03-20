import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("HomePage", () => {
  it("redirects the root route to v2", () => {
    HomePage();

    expect(mocks.redirect).toHaveBeenCalledWith("/v2");
  });
});
