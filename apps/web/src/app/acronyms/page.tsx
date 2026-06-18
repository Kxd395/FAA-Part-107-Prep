"use client";

import { BookOpen, ChevronLeft, FileText, List, RefreshCw, Rows3, Zap } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { StandaloneFlipCard } from "../../components/flashcards/StandaloneFlipCard";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import {
  ACRONYM_ENTRIES,
  buildAcronymQuestion,
  type AcronymEntry,
} from "../../lib/drills/acronyms";
import { shuffle, useThreeChoiceDrill } from "../../lib/drills/threeChoice";

type StudyMode = "flip" | "quiz" | "grid";
type SubsetMode = "all" | AcronymEntry["group"];

const ACRONYM_PREFERENCES_KEY = "part107_acronym_preferences_v1";

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300">
      {children}
    </span>
  );
}

function AcronymCard({
  entry,
  revealed,
  onReveal,
  onNext,
}: {
  entry: AcronymEntry;
  revealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}) {
  return (
    <StandaloneFlipCard
      front={<div className="text-6xl font-bold text-sky-300">{entry.term}</div>}
      back={
        <>
          <div className="text-3xl font-bold text-white">{entry.expansion}</div>
          <div className="mt-3 text-sm text-[var(--muted)]">{entry.note}</div>
        </>
      }
      revealed={revealed}
      onReveal={onReveal}
      onNext={onNext}
      ariaLabel={`Study ${entry.term}`}
      accentClassName="text-sky-300"
    />
  );
}

function FlipMode({ entries }: { entries: AcronymEntry[] }) {
  const [deck, setDeck] = useState(entries);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [randomOrder, setRandomOrder] = useState(false);

  useEffect(() => {
    setDeck(randomOrder ? shuffle(entries) : entries);
    setIndex(0);
    setRevealed(false);
  }, [entries, randomOrder]);

  const current = deck[index];
  if (!current) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          {index + 1} / {deck.length}
        </span>
        <button
          onClick={() => setRandomOrder((value) => !value)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs transition-all ${
            randomOrder
              ? "border-sky-500 bg-sky-500/20 text-sky-300"
              : "border-[var(--card-border)] hover:border-white/30"
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Random
        </button>
      </div>
      <div className="h-1 w-full rounded-full bg-[var(--card-border)]">
        <div
          className="h-1 rounded-full bg-sky-400 transition-all"
          style={{ width: `${((index + 1) / deck.length) * 100}%` }}
        />
      </div>
      <AcronymCard
        entry={current}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onNext={() => {
          setRevealed(false);
          setIndex((value) => (value + 1) % deck.length);
        }}
      />
    </div>
  );
}

function GridMode({ entries }: { entries: AcronymEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-3">Acronym</th>
            <th className="px-4 py-3">Expansion</th>
            <th className="px-4 py-3">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={entry.term}
              className={`border-b border-[var(--card-border)] last:border-0 ${
                index % 2 === 0 ? "bg-[var(--card)]" : "bg-transparent"
              }`}
            >
              <td className="px-4 py-3 text-lg font-bold text-sky-300">{entry.term}</td>
              <td className="px-4 py-3 font-semibold text-white">{entry.expansion}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{entry.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuizMode({ entries }: { entries: AcronymEntry[] }) {
  const { current, next, question, select, selected, selectedIsCorrect, streak } =
    useThreeChoiceDrill(entries, buildAcronymQuestion);

  if (!current || !question) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end text-sm text-[var(--muted)]">
        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 font-semibold text-sky-300">
          {streak} correct in a row
        </span>
      </div>
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-base text-[var(--muted)]">{question.prompt}</p>
        <div className="mt-4 text-6xl font-bold text-sky-300">{current.term}</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {question.options.map((option) => {
          const isCorrect = option === question.answer;
          const isChosen = option === selected;
          let cls = "rounded-lg border px-4 py-4 text-left text-sm font-semibold transition-all ";
          if (selected === null) {
            cls +=
              "border-[var(--card-border)] bg-[var(--card)] hover:border-sky-500/60 hover:bg-sky-500/10";
          } else if (isCorrect) {
            cls += "border-green-500 bg-green-500/20 text-green-300";
          } else if (isChosen) {
            cls += "border-red-500 bg-red-500/20 text-red-300";
          } else {
            cls += "border-[var(--card-border)] bg-[var(--card)] opacity-40";
          }
          return (
            <button key={option} onClick={() => select(option)} className={cls}>
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="space-y-3">
          {selectedIsCorrect ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm text-green-200">
              Correct. <span className="font-semibold text-green-300">{question.answer}</span>{" "}
              is what <span className="font-semibold text-white">{current.term}</span> stands for.
              Loading the next question...
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
                You picked <span className="font-semibold text-white">{selected}</span>. The
                correct answer for <span className="font-semibold text-white">{current.term}</span>{" "}
                is <span className="font-semibold text-green-300">{question.answer}</span>.
              </div>
              <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm">
                <div className="font-semibold text-white">{current.expansion}</div>
                <div className="mt-1 text-[var(--muted)]">{current.note}</div>
              </div>
              <button
                onClick={next}
                className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
              >
                Next
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AcronymsPage() {
  const activeUserId = useActiveUserId();
  const { logEvent } = useLearningEventLogger(activeUserId);
  const [mode, setMode] = useState<StudyMode>("flip");
  const [subset, setSubset] = useState<SubsetMode>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACRONYM_PREFERENCES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        mode?: StudyMode;
        subset?: SubsetMode;
      };
      if (parsed.mode === "flip" || parsed.mode === "grid" || parsed.mode === "quiz") {
        setMode(parsed.mode);
      }
      if (
        parsed.subset === "all" ||
        parsed.subset === "operations" ||
        parsed.subset === "radio" ||
        parsed.subset === "weather"
      ) {
        setSubset(parsed.subset);
      }
    } catch {
      // Ignore malformed local preferences and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ACRONYM_PREFERENCES_KEY, JSON.stringify({ mode, subset }));
  }, [mode, subset]);

  const entries = useMemo(
    () =>
      ACRONYM_ENTRIES.filter((entry) => {
        if (subset === "all") return true;
        return entry.group === subset;
      }),
    [subset]
  );

  useEffect(() => {
    logEvent({ type: "page_view", mode: "acronyms", metadata: { route: "/acronyms" } });
  }, [logEvent]);

  const modes: Array<{ value: StudyMode; label: string; icon: ComponentType<{ className?: string }> }> = [
    { value: "flip", label: "Flip Cards", icon: BookOpen },
    { value: "quiz", label: "Quick Quiz", icon: Zap },
    { value: "grid", label: "Reference Table", icon: Rows3 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Home
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <IconTile>
            <FileText className="h-5 w-5" />
          </IconTile>
          <h1 className="text-3xl font-bold">FAA Acronyms</h1>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Drill the shorthand that shows up constantly in Part 107 study: RPIC, UAS, VO, VLOS,
          LAANC, NOTAM, TFR, FRIA, METAR, TAF, and the rest.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => {
                  setMode(item.value);
                  logEvent({
                    type: "tab_changed",
                    mode: "acronyms",
                    metadata: { tab: item.value },
                  });
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                  mode === item.value
                    ? "border-sky-500 bg-sky-500/20 text-sky-300"
                    : "border-[var(--card-border)] text-[var(--muted)] hover:border-white/30 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <select
          value={subset}
          onChange={(event) => setSubset(event.target.value as SubsetMode)}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-sky-500/60 focus:outline-none"
        >
          <option value="all">All Acronyms</option>
          <option value="operations">Operations</option>
          <option value="radio">Radio & Airspace</option>
          <option value="weather">Weather</option>
        </select>
      </div>

      <div className="mx-auto max-w-lg sm:max-w-none">
        {mode === "flip" && <FlipMode entries={entries} />}
        {mode === "quiz" && <QuizMode entries={entries} />}
        {mode === "grid" && <GridMode entries={entries} />}
      </div>

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-5 py-4 text-sm">
        <div className="flex items-start gap-3">
          <List className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <div>
            <p className="font-semibold text-sky-300">Study Use</p>
            <p className="mt-1 text-[var(--muted)]">
              This stack is separate because the acronym source file is missing from the live
              question bank. You can still drill the terms directly here instead of waiting for
              them to appear incidentally inside multiple-choice explanations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
