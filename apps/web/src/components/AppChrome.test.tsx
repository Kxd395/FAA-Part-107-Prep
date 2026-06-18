import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppChrome from "./AppChrome";

let pathnameMock = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "pilot-user",
}));

vi.mock("../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

describe("AppChrome", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    pathnameMock = "/";
  });

  it("wraps legacy routes with the main app chrome", () => {
    render(
      <AppChrome>
        <div>Legacy content</div>
      </AppChrome>
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("Legacy content")).toBeInTheDocument();
    expect(screen.getByText(/Not affiliated with the FAA/i)).toBeInTheDocument();
  });

  it("does not wrap v2 routes with legacy chrome", () => {
    pathnameMock = "/v2/study";

    render(
      <AppChrome>
        <div>V2 content</div>
      </AppChrome>
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("V2 content")).toBeInTheDocument();
    expect(screen.queryByText(/Not affiliated with the FAA/i)).not.toBeInTheDocument();
  });
});
