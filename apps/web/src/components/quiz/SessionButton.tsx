import type { ButtonHTMLAttributes, ReactNode } from "react";

type SessionButtonVariant =
  | "muted-outline"
  | "brand-outline"
  | "brand-solid"
  | "success-solid"
  | "text-muted";

interface SessionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  variant: SessionButtonVariant;
}

const VARIANT_CLASSNAMES: Record<SessionButtonVariant, string> = {
  "muted-outline":
    "rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed",
  "brand-outline":
    "rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed",
  "brand-solid":
    "rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed",
  "success-solid":
    "rounded-xl bg-correct px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-correct-dark disabled:opacity-40 disabled:cursor-not-allowed",
  "text-muted": "text-[var(--muted)] hover:text-white transition-colors",
};

export default function SessionButton({
  children,
  variant,
  className = "",
  type = "button",
  ...props
}: SessionButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASSNAMES[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
