"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { StandaloneFlipCard } from "../../components/flashcards/StandaloneFlipCard";

// ─── Data ──────────────────────────────────────────────────────────────────────

interface PhoneticEntry {
  character: string;
  word: string;
  pronunciation: string;
  morse: string | null;
}

const ALPHABET_RAW: PhoneticEntry[] = [
  { character: "A", word: "Alfa",     pronunciation: "AL FAH",                   morse: ".-"    },
  { character: "B", word: "Bravo",    pronunciation: "BRAH VOH",                 morse: "-..."  },
  { character: "C", word: "Charlie",  pronunciation: "CHAR LEE / SHAR LEE",      morse: "-.-."  },
  { character: "D", word: "Delta",    pronunciation: "DELL TAH",                 morse: "-.."   },
  { character: "E", word: "Echo",     pronunciation: "ECK OH",                   morse: "."     },
  { character: "F", word: "Foxtrot",  pronunciation: "FOKS TROT",                morse: "..-."  },
  { character: "G", word: "Golf",     pronunciation: "GOLF",                     morse: "--."   },
  { character: "H", word: "Hotel",    pronunciation: "HOH TEL",                  morse: "...."  },
  { character: "I", word: "India",    pronunciation: "IN DEE AH",                morse: ".."    },
  { character: "J", word: "Juliett",  pronunciation: "JEW LEE ETT",              morse: ".---"  },
  { character: "K", word: "Kilo",     pronunciation: "KEY LOH",                  morse: "-.-"   },
  { character: "L", word: "Lima",     pronunciation: "LEE MAH",                  morse: ".-.."  },
  { character: "M", word: "Mike",     pronunciation: "MIKE",                     morse: "--"    },
  { character: "N", word: "November", pronunciation: "NO VEM BER",               morse: "-."    },
  { character: "O", word: "Oscar",    pronunciation: "OSS CAH",                  morse: "---"   },
  { character: "P", word: "Papa",     pronunciation: "PAH PAH",                  morse: ".--."  },
  { character: "Q", word: "Quebec",   pronunciation: "KEH BECK",                 morse: "--.-"  },
  { character: "R", word: "Romeo",    pronunciation: "ROW ME OH",                morse: ".-."   },
  { character: "S", word: "Sierra",   pronunciation: "SEE AIR RAH",              morse: "..."   },
  { character: "T", word: "Tango",    pronunciation: "TANG GO",                  morse: "-"     },
  { character: "U", word: "Uniform",  pronunciation: "YOU NEE FORM / OO NEE FORM", morse: "..-" },
  { character: "V", word: "Victor",   pronunciation: "VIK TAH",                  morse: "...-"  },
  { character: "W", word: "Whiskey",  pronunciation: "WISS KEY",                 morse: ".--"   },
  { character: "X", word: "X-Ray",    pronunciation: "ECKS RAY",                 morse: "-..-"  },
  { character: "Y", word: "Yankee",   pronunciation: "YANG KEY",                 morse: "-.--"  },
  { character: "Z", word: "Zulu",     pronunciation: "ZOO LOO",                  morse: "--.."  },
  { character: "1", word: "One",      pronunciation: "WUN",                      morse: ".----" },
  { character: "2", word: "Two",      pronunciation: "TOO",                      morse: "..---" },
  { character: "3", word: "Three",    pronunciation: "TREE",                     morse: "...--" },
  { character: "4", word: "Four",     pronunciation: "FOW ER",                   morse: "....-" },
  { character: "5", word: "Five",     pronunciation: "FIFE",                     morse: "....." },
  { character: "6", word: "Six",      pronunciation: "SIX",                      morse: "-...." },
  { character: "7", word: "Seven",    pronunciation: "SEV EN",                   morse: "--..." },
  { character: "8", word: "Eight",    pronunciation: "AIT",                      morse: "---.." },
  { character: "9", word: "Nine",     pronunciation: "NIN ER",                   morse: "----." },
  { character: "0", word: "Zero",     pronunciation: "ZE RO",                    morse: "-----" },
  { character: ".",  word: "Decimal", pronunciation: "DAY SEE MAL",              morse: null    },
  { character: "—",  word: "Hundred", pronunciation: "HUN DRED",                 morse: null    },
  { character: "—",  word: "Thousand",pronunciation: "TOU SAND",                 morse: null    },
];

// ─── Modes ─────────────────────────────────────────────────────────────────────

type StudyMode = "flip" | "grid" | "quiz";
type PhoneticSubset = "all" | "letters" | "digits";

const PHONETIC_PREFERENCES_KEY = "part107_phonetic_preferences_v1";

// ─── Flip-card component ───────────────────────────────────────────────────────

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

// ─── Quiz mode ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuizQuestion(
  target: PhoneticEntry,
  pool: PhoneticEntry[]
): { prompt: string; answer: string; options: string[] } {
  const distractors = shuffle(pool.filter((e) => e.word !== target.word))
    .slice(0, 3)
    .map((e) => e.word);
  const options = shuffle([target.word, ...distractors]);
  return {
    prompt: `What is the NATO phonetic word for "${target.character}"?`,
    answer: target.word,
    options,
  };
}

function QuizMode({ entries }: { entries: PhoneticEntry[] }) {
  const pool = entries.filter((e) => /^[A-Z]$/i.test(e.character) || /^\d$/.test(e.character));
  const [queue, setQueue] = useState(() => shuffle(pool));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const current = queue[index];
  const question = current ? buildQuizQuestion(current, pool) : null;

  const handleSelect = (opt: string) => {
    if (selected !== null || !current) return;
    setSelected(opt);
    setScore((s) => ({
      correct: s.correct + (opt === current.word ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const handleNext = () => {
    if (index + 1 >= queue.length) {
      setQueue(shuffle(pool));
      setIndex(0);
    } else {
      setIndex((i) => i + 1);
    }
    setSelected(null);
  };

  if (!question) return null;

  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Question {score.total + 1} · {queue.length} card deck
        </span>
        <span className="text-brand-400 font-semibold">
          {score.total > 0 ? `${score.correct}/${score.total} correct` : ""}
        </span>
      </div>

      {/* Prompt */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-base text-[var(--muted)] mb-2">{question.prompt}</p>
        <div className="text-6xl font-bold text-brand-400 mt-4">{current.character}</div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {question.options.map((opt) => {
          const isCorrect = opt === question.answer;
          const isChosen = opt === selected;
          let cls =
            "rounded-xl border py-4 text-lg font-semibold transition-all ";
          if (selected === null) {
            cls +=
              "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/60 hover:bg-brand-500/10 cursor-pointer";
          } else if (isCorrect) {
            cls += "border-green-500 bg-green-500/20 text-green-300";
          } else if (isChosen) {
            cls += "border-red-500 bg-red-500/20 text-red-300";
          } else {
            cls += "border-[var(--card-border)] bg-[var(--card)] opacity-40";
          }
          return (
            <button key={opt} onClick={() => handleSelect(opt)} className={cls}>
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="space-y-2">
          {/* Pronunciation hint */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-center">
            <span className="text-[var(--muted)]">Pronunciation: </span>
            <span className="font-mono text-brand-300">{current.pronunciation}</span>
            {current.morse && (
              <>
                <span className="mx-2 text-[var(--muted)]">·</span>
                <span className="font-mono text-[var(--muted)]">{current.morse}</span>
              </>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Grid / reference mode ─────────────────────────────────────────────────────

function GridMode({ entries }: { entries: PhoneticEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--card-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-[var(--muted)] uppercase text-xs tracking-wide">
            <th className="px-4 py-3 text-left">Character</th>
            <th className="px-4 py-3 text-left">Word</th>
            <th className="px-4 py-3 text-left">Pronunciation</th>
            <th className="px-4 py-3 text-left font-mono">Morse</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={`${e.character}-${e.word}`}
              className={`border-b border-[var(--card-border)] last:border-0 ${
                i % 2 === 0 ? "bg-[var(--card)]" : "bg-transparent"
              }`}
            >
              <td className="px-4 py-3 font-bold text-brand-400 text-lg">{e.character}</td>
              <td className="px-4 py-3 font-semibold text-white">{e.word}</td>
              <td className="px-4 py-3 font-mono text-brand-300">{e.pronunciation}</td>
              <td className="px-4 py-3 font-mono text-[var(--muted)] tracking-widest">
                {e.morse ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Flip-through mode ─────────────────────────────────────────────────────────

function FlipMode({ entries }: { entries: PhoneticEntry[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [randomOrder, setRandomOrder] = useState(false);
  const [deck, setDeck] = useState(entries);

  const total = deck.length;
  const current = deck[index];

  const toggleRandom = useCallback(() => {
    setRandomOrder((r) => {
      const next = !r;
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
      setIndex((i) => (i + 1) % total);
    }
  }, [current, revealed, total]);

  const handlePrev = useCallback(() => {
    setRevealed(false);
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    setRevealed(false);
    setIndex((i) => (i + 1) % total);
  }, [total]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Enter" || e.key === "f") handleFlip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleFlip, handleNext, handlePrev]);

  if (!current) return null;

  return (
    <div className="space-y-6">
      {/* Progress + controls */}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          {index + 1} / {total}
        </span>
        <button
          onClick={toggleRandom}
          className={`rounded-lg border px-3 py-1 text-xs transition-all ${
            randomOrder
              ? "border-brand-500 bg-brand-500/20 text-brand-300"
              : "border-[var(--card-border)] hover:border-white/30"
          }`}
        >
          🔀 Random
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-[var(--card-border)]">
        <div
          className="h-1 rounded-full bg-brand-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <FlipCard
        key={`${current.character}-${current.word}`}
        entry={current}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onNext={handleNext}
      />

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrev}
          className="flex-1 rounded-xl border border-[var(--card-border)] py-3 text-sm font-semibold text-[var(--muted)] transition-all hover:border-white/30 hover:text-white"
        >
          ← Prev
        </button>
        <button
          onClick={handleNext}
          className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700"
        >
          Next →
        </button>
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        ← → arrow keys · Space to advance · Enter or F to flip
      </p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

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
    localStorage.setItem(
      PHONETIC_PREFERENCES_KEY,
      JSON.stringify({
        mode,
        subset,
      })
    );
  }, [mode, subset]);

  const entries = ALPHABET_RAW.filter((e) => {
    if (subset === "letters") return /^[A-Z]$/i.test(e.character);
    if (subset === "digits") return /^\d$/.test(e.character);
    return true;
  });

  useEffect(() => {
    logEvent({ type: "page_view", mode: "phonetic", metadata: { route: "/phonetic" } });
  }, [logEvent]);

  const MODES: Array<{ value: StudyMode; label: string; emoji: string }> = [
    { value: "flip", label: "Flip Cards", emoji: "🃏" },
    { value: "quiz", label: "Quick Quiz", emoji: "⚡" },
    { value: "grid", label: "Reference Table", emoji: "📋" },
  ];

  const SUBSETS: Array<{ value: PhoneticSubset; label: string }> = [
    { value: "all", label: "All (A–Z + 0–9 + extras)" },
    { value: "letters", label: "Letters only (A–Z)" },
    { value: "digits", label: "Digits only (0–9)" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          ← Home
        </Link>
        <h1 className="mt-3 text-3xl font-bold">
          🔤 NATO Phonetic Alphabet
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Used in all ATC radio communications. Learn letter words, pronunciations, and Morse code.
          Not on the multiple-choice exam — but essential for radio calls on the flight line.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]/60">
          Source: ICAO Doc 9432 / SKYbrary
        </p>
      </div>

      {/* Mode + Subset selectors */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Mode tabs */}
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMode(m.value);
                logEvent({
                  type: "tab_changed",
                  mode: "phonetic",
                  metadata: { tab: m.value },
                });
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                mode === m.value
                  ? "border-brand-500 bg-brand-500/20 text-brand-300"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:border-white/30 hover:text-white"
              }`}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* Subset filter */}
        <select
          value={subset}
          onChange={(e) => setSubset(e.target.value as typeof subset)}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-brand-500/60 focus:outline-none"
        >
          {SUBSETS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mode content */}
      <div className="max-w-lg mx-auto sm:max-w-none">
        {mode === "flip" && <FlipMode entries={entries} />}
        {mode === "quiz" && <QuizMode entries={entries} />}
        {mode === "grid" && <GridMode entries={entries} />}
      </div>

      {/* Study tip */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm">
        <p className="font-semibold text-amber-300">💡 Study Tip</p>
        <p className="mt-1 text-[var(--muted)]">
          The phonetic alphabet itself is <strong className="text-white">not tested</strong> on the Part 107 knowledge exam —
          but you&apos;ll use it every time you call ground control, CTAF, or request a TFR briefing.
          Focus on the tricky ones: <strong className="text-white">Alfa</strong> (not Alpha),
          <strong className="text-white"> Juliett</strong> (double-T),
          <strong className="text-white"> Foxtrot</strong>, and
          <strong className="text-white"> November</strong> (N).
        </p>
      </div>
    </div>
  );
}
