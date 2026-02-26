import type { AttemptConfidence } from "@part107/core";
import type { ReactNode } from "react";
import ConfidenceSelector from "./ConfidenceSelector";

interface ConfidencePanelProps {
  title: ReactNode;
  value: AttemptConfidence;
  onChange: (value: AttemptConfidence) => void;
  hint?: ReactNode;
  containerClassName?: string;
  titleClassName?: string;
  selectorClassName?: string;
  selectorSize?: "sm" | "md";
}

export default function ConfidencePanel({
  title,
  value,
  onChange,
  hint,
  containerClassName = "p-3",
  titleClassName = "text-center text-xs font-medium text-[var(--muted)]",
  selectorClassName,
  selectorSize = "sm",
}: ConfidencePanelProps) {
  return (
    <div className={`rounded-xl border border-brand-500/20 bg-brand-500/5 ${containerClassName}`}>
      <div className={titleClassName}>{title}</div>
      <ConfidenceSelector
        value={value}
        onChange={onChange}
        className={selectorClassName}
        size={selectorSize}
      />
      {hint && <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}
