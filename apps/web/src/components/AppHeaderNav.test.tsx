import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppHeaderNav from "./AppHeaderNav";

const pushMock = vi.fn();
const logEventMock = vi.fn();
const signOutMock = vi.fn();

let pathnameMock = "/study";
let authStateMock: {
  user: { userId: string; email: string | null; displayName: string | null } | null;
  loading: boolean;
} = {
  user: null,
  loading: false,
};

vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    className,
    children,
  }: {
    href: string;
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      className={className}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "pilot-user",
}));

vi.mock("../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: logEventMock,
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: authStateMock.user,
    loading: authStateMock.loading,
    signOut: signOutMock,
    refreshSession: vi.fn(),
  }),
}));

describe("AppHeaderNav", () => {
  beforeEach(() => {
    pathnameMock = "/study";
    authStateMock = { user: null, loading: false };
    logEventMock.mockReset();
    signOutMock.mockReset();
    pushMock.mockReset();
  });

  it("renders sign-in link and logs header navigation clicks", async () => {
    const user = userEvent.setup();
    render(<AppHeaderNav />);

    expect(screen.getByRole("link", { name: /Sign In/i })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Study" }));

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "link_opened",
        mode: "study",
        metadata: expect.objectContaining({
          target: "header_nav_study",
          href: "/study",
        }),
      })
    );
  });

  it("signs out and navigates to login from the profile menu", async () => {
    const user = userEvent.setup();
    authStateMock = {
      loading: false,
      user: {
        userId: "pilot-user",
        email: "pilot@example.com",
        displayName: "Pilot",
      },
    };
    signOutMock.mockResolvedValue(undefined);

    render(<AppHeaderNav />);

    await user.click(screen.getByRole("button", { name: "P" }));
    await user.click(screen.getByRole("button", { name: /Sign Out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
