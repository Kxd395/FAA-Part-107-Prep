import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, AuthProvider } from "./AuthProvider";

const migrateMock = vi.fn();

vi.mock("../lib/localUserStateMigration", () => ({
  migrateLegacyLocalUserStateToUser: (userId: string) => migrateMock(userId),
}));

function Harness() {
  const context = useContext(AuthContext);
  if (!context) return null;
  return (
    <div>
      <div data-testid="loading">{String(context.loading)}</div>
      <div data-testid="user-id">{context.user?.userId ?? "none"}</div>
      <button onClick={() => void context.refreshSession()}>refresh</button>
      <button onClick={() => void context.signOut()}>signout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    migrateMock.mockReset();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("hydrates authenticated session and runs legacy migration", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        userId: "pilot-user",
        email: "pilot@example.com",
        displayName: "Pilot",
      }),
    } as Response);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("pilot-user");
    });
    expect(migrateMock).toHaveBeenCalledWith("pilot-user");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("clears user state on sign out", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (typeof input === "string" && input === "/api/auth/session" && !init?.method) {
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            userId: "pilot-user",
            email: "pilot@example.com",
            displayName: "Pilot",
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("pilot-user");
    });

    await user.click(screen.getByRole("button", { name: /signout/i }));
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("none");
    });
  });
});
