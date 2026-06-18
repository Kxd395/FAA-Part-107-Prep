import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../components/AuthProvider";
import type { useAuth as useAuthType } from "./useAuth";

function HookReader({ useAuthImpl }: { useAuthImpl: typeof useAuthType }) {
  const auth = useAuthImpl();
  return <div>{auth.user?.userId ?? "none"}</div>;
}

describe("useAuth", () => {
  it("throws when used outside AuthProvider context", async () => {
    vi.resetModules();
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      return { ...actual, useContext: () => undefined };
    });

    try {
      const { useAuth } = await import("./useAuth");
      expect(() => useAuth()).toThrow("useAuth must be used within an AuthProvider");
    } finally {
      vi.doUnmock("react");
      vi.resetModules();
    }
  });

  it("returns context value when provider is present", async () => {
    const [{ AuthContext }, { useAuth }] = await Promise.all([
      import("../components/AuthProvider"),
      import("./useAuth"),
    ]);
    const value: AuthContextValue = {
      user: { userId: "pilot-user", email: null, displayName: "Pilot" },
      loading: false,
      refreshSession: async () => {},
      signOut: async () => {},
    };

    const { getByText } = render(
      <AuthContext.Provider value={value}>
        <HookReader useAuthImpl={useAuth} />
      </AuthContext.Provider>
    );
    expect(getByText("pilot-user")).toBeInTheDocument();
  });
});
