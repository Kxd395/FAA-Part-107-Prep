import type { ReactNode } from "react";

type ActionBarLayout = "spread" | "cluster" | "text";

interface ActionBarProps {
  children: ReactNode;
  layout?: ActionBarLayout;
  className?: string;
}

export default function ActionBar({
  children,
  layout = "spread",
  className = "",
}: ActionBarProps) {
  const layoutClass =
    layout === "cluster"
      ? "flex items-center gap-3"
      : layout === "text"
        ? "flex justify-between text-sm"
        : "flex items-center justify-between gap-3";

  return <div className={`${layoutClass} ${className}`.trim()}>{children}</div>;
}
