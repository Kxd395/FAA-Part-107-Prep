"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";

interface AcronymEntry {
  term: string;
  expansion: string;
  note: string;
  group: "operations" | "radio" | "weather";
}

const ACRONYM_RAW: AcronymEntry[] = [
  { term: "RPIC", expansion: "Remote Pilot in Command", note: "The certificated remote pilot responsible for the operation.", group: "operations" },
  { term: "UAS", expansion: "Unmanned Aircraft System", note: "The aircraft, control station, link, and support equipment as a complete system.", group: "operations" },
  { term: "sUAS", expansion: "small Unmanned Aircraft System", note: "A UAS under 55 pounds within standard Part 107 scope.", group: "operations" },
  { term: "UA", expansion: "Unmanned Aircraft", note: "The aircraft itself, not the whole system.", group: "operations" },
  { term: "VO", expansion: "Visual Observer", note: "Crewmember assisting the RPIC with visual scanning and situational awareness.", group: "operations" },
  { term: "VLOS", expansion: "Visual Line of Sight", note: "The aircraft must remain visible without aids other than corrective lenses.", group: "operations" },
  { term: "BVLOS", expansion: "Beyond Visual Line of Sight", note: "Operations beyond normal visual-line-of-sight limits.", group: "operations" },
  { term: "FRIA", expansion: "FAA-Recognized Identification Area", note: "Area where certain aircraft may operate without standard Remote ID broadcast.", group: "operations" },
  { term: "RID", expansion: "Remote Identification", note: "Broadcast identity/location rules under the Remote ID framework.", group: "operations" },
  { term: "CRM", expansion: "Crew Resource Management", note: "Use of people, equipment, and information to improve safety and decision-making.", group: "operations" },
  { term: "ATC", expansion: "Air Traffic Control", note: "Controllers responsible for traffic management and controlled-airspace authorization.", group: "radio" },
  { term: "CTAF", expansion: "Common Traffic Advisory Frequency", note: "Self-announce frequency used at non-towered airports.", group: "radio" },
  { term: "LAANC", expansion: "Low Altitude Authorization and Notification Capability", note: "System for near-real-time authorization in controlled airspace.", group: "radio" },
  { term: "NOTAM", expansion: "Notice to Air Missions", note: "Time-sensitive aeronautical notice that may affect a flight.", group: "radio" },
  { term: "TFR", expansion: "Temporary Flight Restriction", note: "Temporary airspace restriction that can prohibit or limit drone operations.", group: "radio" },
  { term: "AGL", expansion: "Above Ground Level", note: "Altitude measured from the terrain directly below the aircraft.", group: "operations" },
  { term: "MSL", expansion: "Mean Sea Level", note: "Altitude referenced to average sea level.", group: "operations" },
  { term: "METAR", expansion: "Meteorological Aerodrome Report", note: "Current observed weather report for an airport.", group: "weather" },
  { term: "TAF", expansion: "Terminal Aerodrome Forecast", note: "Forecast weather report for an airport and surrounding area.", group: "weather" },
];

type StudyMode = "flip" | "quiz" | "grid";
type SubsetMode = "all" | AcronymEntry["group"];

const ACRONYM_PREFERENCES_KEY = "part107_acronym_preferences_v1";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
    <button
      onClick={revealed ? onNext : onReveal}
      className="flex h-72 w-full flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-6 text-center transition-all hover:border-white/20"
      aria-label={`Study ${entry.term}`}
    >
      {!revealed ? (
        <>
          <div className="text-6xl font-bold text-sky-300">{entry.term}</div>
          <div className="mt-4 text-xs uppercase tracking-widest text-[var(--muted)]">
            Tap to reveal
          </div>
        </>
      ) : (
        <>
          <div className="text-3xl font-bold text-white">{entry.expansion}</div>
          <div className="mt-3 text-sm text-[var(--muted)]">{entry.note}</div>
          <div className="mt-4 text-xs uppercase tracking-widest text-sky-300">
            Tap for next
          </div>
        </>
      )}
    </button>
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
          className={`rounded-lg border px-3 py-1 text-xs transition-all ${
            randomOrder
              ? "border-sky-500 bg-sky-500/20 text-sky-300"
              : "border-[var(--card-border)] hover:border-white/30"
          }`}
        >
          🔀 Random
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
    <div className="overflow-x-auto rounded-2xl border border-[var(--card-border)]">
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
  const [queue, setQueue] = useState(() => shuffle(entries));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    setQueue(shuffle(entries));
    setIndex(0);
    setSelected(null);
    setScore({ correct: 0, total: 0 });
  }, [entries]);

  const current = queue[index];
  const options = current
    ? shuffle([
        current.expansion,
        ...shuffle(entries.filter((entry) => entry.term !== current.term))
          .slice(0, 3)
          .map((entry) => entry.expansion),
      ])
    : [];

  if (!current) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Question {score.total + 1} · {queue.length} card deck
        </span>
        <span className="font-semibold text-sky-300">
          {score.total > 0 ? `${score.correct}/${score.total} correct` : ""}
        </span>
      </div>
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-base text-[var(--muted)]">What does {current.term} stand for?</p>
        <div className="mt-4 text-6xl font-bold text-sky-300">{current.term}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isCorrect = option === current.expansion;
          const isChosen = option === selected;
          let cls = "rounded-xl border px-4 py-4 text-left text-sm font-semibold transition-all ";
          if (selected === null) {
            cls += "border-[var(--card-border)] bg-[var(--card)] hover:border-sky-500/60 hover:bg-sky-500/10";
          } else if (isCorrect) {
            cls += "border-green-500 bg-green-500/20 text-green-300";
          } else if (isChosen) {
            cls += "border-red-500 bg-red-500/20 text-red-300";
          } else {
            cls += "border-[var(--card-border)] bg-[var(--card)] opacity-40";
          }
          return (
            <button
              key={option}
              onClick={() => {
                if (selected !== null) return;
                setSelected(option);
                setScore((value) => ({
                  correct: value.correct + (option === current.expansion ? 1 : 0),
                  total: value.total + 1,
                }));
              }}
              className={cls}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm">
            <div className="font-semibold text-white">{current.expansion}</div>
            <div className="mt-1 text-[var(--muted)]">{current.note}</div>
          </div>
          <button
            onClick={() => {
              if (index + 1 >= queue.length) {
                setQueue(shuffle(entries));
                setIndex(0);
              } else {
                setIndex((value) => value + 1);
              }
              setSelected(null);
            }}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
          >
            Next →
          </button>
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
    localStorage.setItem(
      ACRONYM_PREFERENCES_KEY,
      JSON.stringify({
        mode,
        subset,
      })
    );
  }, [mode, subset]);

  const entries = useMemo(
    () =>
      ACRONYM_RAW.filter((entry) => {
        if (subset === "all") return true;
        return entry.group === subset;
      }),
    [subset]
  );

  useEffect(() => {
    logEvent({ type: "page_view", mode: "acronyms", metadata: { route: "/acronyms" } });
  }, [logEvent]);

  const modes: Array<{ value: StudyMode; label: string; emoji: string }> = [
    { value: "flip", label: "Flip Cards", emoji: "🃏" },
    { value: "quiz", label: "Quick Quiz", emoji: "⚡" },
    { value: "grid", label: "Reference Table", emoji: "📋" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-[var(--muted)] transition-colors hover:text-white">
          ← Home
        </Link>
        <h1 className="mt-3 text-3xl font-bold">🧾 FAA Acronyms</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Drill the shorthand that shows up constantly in Part 107 study: RPIC, UAS, VO, VLOS,
          LAANC, NOTAM, TFR, FRIA, METAR, TAF, and the rest.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {modes.map((item) => (
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
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                mode === item.value
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:border-white/30 hover:text-white"
              }`}
            >
              {item.emoji} {item.label}
            </button>
          ))}
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

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-5 py-4 text-sm">
        <p className="font-semibold text-sky-300">Study Use</p>
        <p className="mt-1 text-[var(--muted)]">
          This stack is separate because the acronym source file is missing from the live question
          bank. You can still drill the terms directly here instead of waiting for them to appear
          incidentally inside multiple-choice explanations.
        </p>
      </div>
    </div>
  );
}
