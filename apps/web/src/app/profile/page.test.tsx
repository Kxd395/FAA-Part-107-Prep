import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refreshSession: vi.fn<() => Promise<void>>(),
  signOut: vi.fn<() => Promise<void>>(),
  user: null as { userId: string; email: string | null; displayName: string | null } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    refreshSession: mocks.refreshSession,
    signOut: mocks.signOut,
  }),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refreshSession.mockReset();
    mocks.signOut.mockReset();
    mocks.user = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows login redirect state when user is missing", () => {
    render(<ProfilePage />);
    expect(screen.getByText(/Redirecting to login/i)).toBeInTheDocument();
  });

  it("updates display name and refreshes session", async () => {
    mocks.user = {
      userId: "u_1",
      email: "pilot@example.com",
      displayName: "Pilot One",
    };
    mocks.refreshSession.mockResolvedValue();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText(/Display Name/i), { target: { value: "Captain Pilot" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });

  it("signs out and redirects to login", async () => {
    mocks.user = {
      userId: "u_1",
      email: "pilot@example.com",
      displayName: "Pilot One",
    };
    mocks.signOut.mockResolvedValue();

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /Sign Out/i }));

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
      expect(mocks.push).toHaveBeenCalledWith("/login");
    });
  });
});
