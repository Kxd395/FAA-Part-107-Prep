import type { Question } from "@part107/core";
import { useEffect, useState } from "react";
import type { ResolvedReference } from "../ReferenceModal";
import { resolveFigureImageUrl } from "../../lib/figureImage";
import { isUnresolvedFigurePlaceholderText } from "../../lib/figurePlaceholder";
import QuestionProvenanceBar from "./QuestionProvenanceBar";

function formatFigureLabel(figureRef: string | null): string {
  if (!figureRef) return "Figure";
  return figureRef.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface QuestionCardProps {
  question: Question;
  onOpenFigure: (ref: ResolvedReference) => void;
}

export default function QuestionCard({ question, onOpenFigure }: QuestionCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const figureLabel = formatFigureLabel(question.figure_reference);
  const imageRef = resolveFigureImageUrl(question);
  const hasPlaceholderFigureText = isUnresolvedFigurePlaceholderText(question.figure_text);
  const figureTextToRender = hasPlaceholderFigureText ? null : question.figure_text;

  useEffect(() => {
    setImageFailed(false);
  }, [question.id, imageRef]);

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
      <p className="text-lg leading-relaxed whitespace-pre-line">{question.question_text}</p>

      {imageRef && !imageFailed && (
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-2 overflow-hidden cursor-pointer hover:border-brand-500/50 transition-colors"
          onClick={() =>
            onOpenFigure({
              label: figureLabel,
              type: "image",
              url: imageRef,
              description: `AKTS Supplement — ${question.figure_reference ?? "Figure"}`,
            })
          }
        >
          <p className="mb-2 text-xs font-medium text-[var(--muted)] text-center uppercase tracking-wide">
            📊 {figureLabel} <span className="text-brand-400 ml-1">(tap to enlarge)</span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageRef}
            alt={question.figure_reference ?? "Figure"}
            onError={() => setImageFailed(true)}
            className="w-full rounded-lg max-h-[500px] object-contain"
          />
        </button>
      )}

      {(imageFailed || !imageRef) && figureTextToRender && (
        <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
          <p className="mb-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
            📊 {figureLabel}
          </p>
          <pre className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
            {figureTextToRender}
          </pre>
        </div>
      )}

      {(question.figure_reference || hasPlaceholderFigureText) &&
        (imageFailed || !imageRef) &&
        !figureTextToRender && (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background)] p-4 text-center text-sm text-[var(--muted)]">
          📊 Figure unavailable for this question in the current build.
        </div>
      )}

      <QuestionProvenanceBar question={question} />
    </div>
  );
}
