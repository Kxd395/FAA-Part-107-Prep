import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refreshSession: vi.fn<() => Promise<void>>(),
  user: null as { userId: string; email: string | null; displayName: string | null } | null,
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
  useSearchParams: () => ({
    get: (key: string) => mocks.searchParams.get(key),
  }),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    refreshSession: mocks.refreshSession,
    signOut: vi.fn(),
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.refreshSession.mockReset();
    mocks.user = null;
    mocks.searchParams = new URLSearchParams();
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("requests magic link and shows dev URL status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ sent: true, devUrl: "http://localhost:3000/login?token=dev-token" }),
    } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "pilot@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Magic Link/i }));

    expect(await screen.findByText(/\[DEV\] Magic Link URL:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Use a different email/i })).toBeInTheDocument();
  });

  it("redirects authenticated users to sanitized returnUrl", async () => {
    mocks.user = {
      userId: "u_1",
      email: "pilot@example.com",
      displayName: "Pilot",
    };
    mocks.searchParams = new URLSearchParams("returnUrl=%2Fstudy%3Ftype%3Dconfirmed_test");

    render(<LoginPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/study?type=confirmed_test");
    });
  });
});
