"use client";

import { useMemo, useState } from "react";
import type { OptionId, Question } from "@part107/core";

interface QuestionIssueReporterProps {
  mode: "study" | "exam" | "learn" | "flashcards" | "missed";
  question: Pick<
    Question,
    | "id"
    | "question_text"
    | "category"
    | "subcategory"
    | "options"
    | "correct_option_id"
    | "source"
    | "source_type"
  >;
  selectedOptionId?: OptionId | null;
  questionTypeProfile?: string;
  confidence?: 1 | 2 | 3 | 4 | 5 | null;
}

const MAX_NOTE_LENGTH = 280;

export default function QuestionIssueReporter({
  mode,
  question,
  selectedOptionId = null,
  questionTypeProfile,
  confidence = null,
}: QuestionIssueReporterProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const canSubmit = useMemo(() => note.trim().length > 0 && !submitting, [note, submitting]);

  async function submitIssue() {
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus("idle");
    try {
      const response = await fetch("/api/user/question-issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report: {
            mode,
            questionId: question.id,
            questionText: question.question_text,
            category: question.category,
            subcategory: question.subcategory,
            options: question.options.map((option) => ({ id: option.id, text: option.text })),
            correctOptionId: question.correct_option_id,
            selectedOptionId,
            note: note.trim(),
            questionTypeProfile: questionTypeProfile ?? null,
            source: question.source ?? null,
            sourceType: question.source_type ?? null,
            confidence,
            metadata: {
              surfacedVia: "in-question-reporter",
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`request failed: ${response.status}`);
      }
      setNote("");
      setOpen(false);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          Found a bad question or answer key?
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setOpen((prev) => !prev);
          }}
          className="rounded-md border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-white"
        >
          {open ? "Close" : "Report issue"}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            placeholder="One line: what is wrong?"
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:border-brand-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submitIssue()}
            disabled={!canSubmit}
            className="rounded-md border border-brand-500/50 bg-brand-500/15 px-3 py-2 text-xs font-medium text-brand-300 transition-colors hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      )}

      {status === "success" && (
        <p className="mt-2 text-xs text-green-300" role="status">
          Issue submitted. Thanks.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-incorrect" role="alert">
          Could not submit right now. Try again.
        </p>
      )}
    </div>
  );
}
