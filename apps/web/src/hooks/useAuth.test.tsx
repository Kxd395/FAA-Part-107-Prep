import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "../components/AuthProvider";
import { useAuth } from "./useAuth";

function HookReader() {
  const auth = useAuth();
  return <div>{auth.user?.userId ?? "none"}</div>;
}

describe("useAuth", () => {
  it("throws when used outside AuthProvider context", () => {
    expect(() => render(<HookReader />)).toThrow("useAuth must be used within an AuthProvider");
  });

  it("returns context value when provider is present", () => {
    const value: AuthContextValue = {
      user: { userId: "pilot-user", email: null, displayName: "Pilot" },
      loading: false,
      refreshSession: async () => {},
      signOut: async () => {},
    };

    const { getByText } = render(
      <AuthContext.Provider value={value}>
        <HookReader />
      </AuthContext.Provider>
    );
    expect(getByText("pilot-user")).toBeInTheDocument();
  });
});
