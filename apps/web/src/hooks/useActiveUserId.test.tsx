import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "../components/AuthProvider";
import { LOCAL_USER_ID } from "../lib/analyticsTaxonomy";
import { useActiveUserId } from "./useActiveUserId";

function HookReader() {
  const userId = useActiveUserId();
  return <div>{userId}</div>;
}

describe("useActiveUserId", () => {
  it("falls back to local user id when unauthenticated", () => {
    const value: AuthContextValue = {
      user: null,
      loading: false,
      refreshSession: async () => {},
      signOut: async () => {},
    };

    const { getByText } = render(
      <AuthContext.Provider value={value}>
        <HookReader />
      </AuthContext.Provider>
    );
    expect(getByText(LOCAL_USER_ID)).toBeInTheDocument();
  });

  it("returns authenticated user id", () => {
    const value: AuthContextValue = {
      user: { userId: "pilot-user", email: "pilot@example.com", displayName: "Pilot" },
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
