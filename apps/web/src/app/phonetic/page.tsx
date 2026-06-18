"use client";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Languages,
  Lightbulb,
  RefreshCw,
  Rows3,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StandaloneFlipCard } from "../../components/flashcards/StandaloneFlipCard";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import {
  buildPhoneticQuestion,
  PHONETIC_ENTRIES,
  type PhoneticEntry,
} from "../../lib/drills/phonetic";
import { shuffle, useThreeChoiceDrill } from "../../lib/drills/threeChoice";

type StudyMode = "flip" | "grid" | "quiz";
type PhoneticSubset = "all" | "letters" | "digits";

const PHONETIC_PREFERENCES_KEY = "part107_phonetic_preferences_v1";

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-400/20 bg-brand-400/10 text-brand-300">
      {children}
    </span>
  );
}

function FlipCard({
  entry,
  revealed,
  onReveal,
  onNext,
}: {
  entry: PhoneticEntry;
  revealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}) {
  return (
    <StandaloneFlipCard
      front={
        <div className="text-7xl font-bold leading-none text-brand-400 sm:text-8xl">
          {entry.character}
        </div>
      }
      back={
        <>
          <div className="text-4xl font-bold text-white sm:text-5xl">{entry.word}</div>
          <div className="mt-3 text-lg font-mono tracking-wider text-brand-300">
            {entry.pronunciation}
          </div>
          {entry.morse && (
            <div className="mt-1 text-2xl font-mono tracking-widest text-[var(--muted)]">
              {entry.morse}
            </div>
          )}
        </>
      }
      revealed={revealed}
      onReveal={onReveal}
      onNext={onNext}
      ariaLabel={`Study ${entry.character}`}
      accentClassName="text-brand-300"
      className="h-64 sm:h-72"
    />
  );
}

function QuizMode({ entries }: { entries: PhoneticEntry[] }) {
  const pool = useMemo(
    () => entries.filter((entry) => /^[A-Z]$/i.test(entry.character) || /^\d$/.test(entry.character)),
    [entries]
  );
  const { current, next, question, select, selected, selectedIsCorrect, streak } =
    useThreeChoiceDrill(pool, buildPhoneticQuestion);

  if (!question || !current) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end text-sm text-[var(--muted)]">
        <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 font-semibold text-brand-300">
          {streak} correct in a row
        </span>
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="mb-2 text-base text-[var(--muted)]">{question.prompt}</p>
        <div
          role="heading"
          aria-level={2}
          aria-label={`Current phonetic character: ${current.character}`}
          className="mt-4 text-6xl font-bold text-brand-400"
        >
          {current.character}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {question.options.map((option) => {
          const isCorrect = option === question.answer;
          const isChosen = option === selected;
          let cls = "rounded-lg border py-4 text-lg font-semibold transition-all ";
          if (selected === null) {
            cls +=
              "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/60 hover:bg-brand-500/10";
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
        <div className="space-y-2">
          {selectedIsCorrect ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm text-green-200">
              Correct. <span className="font-semibold text-green-300">{question.answer}</span>{" "}
              is the NATO word for{" "}
              <span className="font-semibold text-white">{current.character}</span>. Loading the
              next question...
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
                You picked <span className="font-semibold text-white">{selected}</span>. The
                correct answer for{" "}
                <span className="font-semibold text-white">{current.character}</span> is{" "}
                <span className="font-semibold text-green-300">{question.answer}</span>.
              </div>
              <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-center text-sm">
                <span className="text-[var(--muted)]">Pronunciation: </span>
                <span className="font-mono text-brand-300">{current.pronunciation}</span>
                {current.morse && (
                  <>
                    <span className="mx-2 text-[var(--muted)]">/</span>
                    <span className="font-mono text-[var(--muted)]">{current.morse}</span>
                  </>
                )}
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

function GridMode({ entries }: { entries: PhoneticEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-3 text-left">Character</th>
            <th className="px-4 py-3 text-left">Word</th>
            <th className="px-4 py-3 text-left">Pronunciation</th>
            <th className="px-4 py-3 text-left font-mono">Morse</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.character}-${entry.word}`}
              className={`border-b border-[var(--card-border)] last:border-0 ${
                index % 2 === 0 ? "bg-[var(--card)]" : "bg-transparent"
              }`}
            >
              <td className="px-4 py-3 text-lg font-bold text-brand-400">{entry.character}</td>
              <td className="px-4 py-3 font-semibold text-white">{entry.word}</td>
              <td className="px-4 py-3 font-mono text-brand-300">{entry.pronunciation}</td>
              <td className="px-4 py-3 font-mono tracking-widest text-[var(--muted)]">
                {entry.morse ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlipMode({ entries }: { entries: PhoneticEntry[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [randomOrder, setRandomOrder] = useState(false);
  const [deck, setDeck] = useState(entries);

  const total = deck.length;
  const current = deck[index];

  const toggleRandom = useCallback(() => {
    setRandomOrder((value) => {
      const next = !value;
      setDeck(next ? shuffle(entries) : entries);
      setIndex(0);
      setRevealed(false);
      return next;
    });
  }, [entries]);

  const handleFlip = useCallback(() => {
    if (!current) return;
    if (!revealed) {
      setRevealed(true);
    } else {
      setRevealed(false);
      setIndex((value) => (value + 1) % total);
    }
  }, [current, revealed, total]);

  const handlePrev = useCallback(() => {
    setRevealed(false);
    setIndex((value) => (value - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    setRevealed(false);
    setIndex((value) => (value + 1) % total);
  }, [total]);

  useEffect(() => {
    setDeck(randomOrder ? shuffle(entries) : entries);
    setIndex(0);
    setRevealed(false);
  }, [entries, randomOrder]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") handleNext();
      if (event.key === "ArrowLeft") handlePrev();
      if (event.key === "Enter" || event.key.toLowerCase() === "f") handleFlip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleFlip, handleNext, handlePrev]);

  if (!current) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          {index + 1} / {total}
        </span>
        <button
          onClick={toggleRandom}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs transition-all ${
            randomOrder
              ? "border-brand-500 bg-brand-500/20 text-brand-300"
              : "border-[var(--card-border)] hover:border-white/30"
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Random
        </button>
      </div>

      <div className="h-1 w-full rounded-full bg-[var(--card-border)]">
        <div
          className="h-1 rounded-full bg-brand-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <FlipCard
        key={`${current.character}-${current.word}`}
        entry={current}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onNext={handleNext}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handlePrev}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] py-3 text-sm font-semibold text-[var(--muted)] transition-all hover:border-white/30 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <button
          onClick={handleNext}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        Arrow keys, Space, Enter, and F are supported.
      </p>
    </div>
  );
}

export default function PhoneticPage() {
  const activeUserId = useActiveUserId();
  const { logEvent } = useLearningEventLogger(activeUserId);
  const [mode, setMode] = useState<StudyMode>("flip");
  const [subset, setSubset] = useState<PhoneticSubset>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PHONETIC_PREFERENCES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        mode?: StudyMode;
        subset?: PhoneticSubset;
      };
      if (parsed.mode === "flip" || parsed.mode === "grid" || parsed.mode === "quiz") {
        setMode(parsed.mode);
      }
      if (parsed.subset === "all" || parsed.subset === "letters" || parsed.subset === "digits") {
        setSubset(parsed.subset);
      }
    } catch {
      // Ignore malformed local preferences and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PHONETIC_PREFERENCES_KEY, JSON.stringify({ mode, subset }));
  }, [mode, subset]);

  const entries = useMemo(
    () =>
      PHONETIC_ENTRIES.filter((entry) => {
        if (subset === "letters") return /^[A-Z]$/i.test(entry.character);
        if (subset === "digits") return /^\d$/.test(entry.character);
        return true;
      }),
    [subset]
  );

  useEffect(() => {
    logEvent({ type: "page_view", mode: "phonetic", metadata: { route: "/phonetic" } });
  }, [logEvent]);

  const modes: Array<{ value: StudyMode; label: string; icon: ComponentType<{ className?: string }> }> = [
    { value: "flip", label: "Flip Cards", icon: BookOpen },
    { value: "quiz", label: "Quick Quiz", icon: Zap },
    { value: "grid", label: "Reference Table", icon: Rows3 },
  ];

  const subsets: Array<{ value: PhoneticSubset; label: string }> = [
    { value: "all", label: "All (A-Z + 0-9 + extras)" },
    { value: "letters", label: "Letters only (A-Z)" },
    { value: "digits", label: "Digits only (0-9)" },
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
            <Languages className="h-5 w-5" />
          </IconTile>
          <h1 className="text-3xl font-bold">NATO Phonetic Alphabet</h1>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Used in ATC radio communications. Learn letter words, pronunciations, and Morse code.
          Not on the multiple-choice exam, but useful for radio calls on the flight line.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]/60">Source: ICAO Doc 9432 / SKYbrary</p>
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
                    mode: "phonetic",
                    metadata: { tab: item.value },
                  });
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                  mode === item.value
                    ? "border-brand-500 bg-brand-500/20 text-brand-300"
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
          onChange={(event) => setSubset(event.target.value as PhoneticSubset)}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-brand-500/60 focus:outline-none"
        >
          {subsets.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mx-auto max-w-lg sm:max-w-none">
        {mode === "flip" && <FlipMode entries={entries} />}
        {mode === "quiz" && <QuizMode entries={entries} />}
        {mode === "grid" && <GridMode entries={entries} />}
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-300">Study Tip</p>
            <p className="mt-1 text-[var(--muted)]">
              The phonetic alphabet itself is <strong className="text-white">not tested</strong>{" "}
              on the Part 107 knowledge exam, but you will use it every time you call ground
              control, CTAF, or request a TFR briefing. Focus on the tricky ones:{" "}
              <strong className="text-white">Alfa</strong> (not Alpha),{" "}
              <strong className="text-white">Juliett</strong> (double-T),{" "}
              <strong className="text-white">Foxtrot</strong>, and{" "}
              <strong className="text-white">November</strong> (N).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
