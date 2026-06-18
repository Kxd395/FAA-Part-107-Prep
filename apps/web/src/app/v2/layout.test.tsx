import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import V2Layout from "./layout";

let pathnameMock = "/v2";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
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

describe("V2Layout", () => {
  beforeEach(() => {
    pathnameMock = "/v2";
  });

  it("uses production branding without preview copy", () => {
    render(
      <V2Layout>
        <div>Dashboard content</div>
      </V2Layout>
    );

    expect(screen.getByText("DarkWater")).toBeInTheDocument();
    expect(screen.getByText("Part 107 Prep")).toBeInTheDocument();
    expect(screen.getByText("Production study workspace")).toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/v2 is now/i)).not.toBeInTheDocument();
  });
});
