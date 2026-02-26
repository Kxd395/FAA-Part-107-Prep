"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EXAM_DEFAULTS,
  FULL_EXAM_QUESTION_COUNT,
  QUESTION_TYPE_PROFILE_LABELS,
  type QuestionTypeProfile,
} from "@part107/core";
import { useActiveUserId } from "../hooks/useActiveUserId";
import { useLearningEventLogger } from "../hooks/useLearningEventLogger";
import { useQuestionBank } from "../hooks/useQuestionBank";
import { STUDY_CATEGORIES, countQuestionsByCategory, type StudyCategory } from "../lib/questionBank";
import {
  readPreferredQuestionType,
  writePreferredQuestionType,
} from "../lib/questionTypePreferenceStore";
import { SELECTABLE_QUESTION_TYPE_OPTIONS as QUESTION_TYPE_OPTIONS } from "../lib/questionTypeOptions";
import { SOURCE_PACK_REGISTRY } from "../lib/sourcePackRegistry";
import {
  readLearningPreferences,
  readWeeklyGoalProgress,
  writeLearningPreferences,
} from "../lib/learningPreferencesStore";

const FEATURES = [
  {
    icon: "📖",
    title: "Study Mode",
    description:
      "Answer questions with instant feedback. See why you were right — or exactly why you were wrong.",
    href: "/study",
    color: "from-blue-500/20 to-blue-600/5",
  },
  {
    icon: "🎯",
    title: "Exam Mode",
    description:
      "60 questions, 2 hours — just like the real FAA test. Mark questions for review. See your score at the end.",
    href: "/exam",
    color: "from-purple-500/20 to-purple-600/5",
  },
  {
    icon: "🃏",
    title: "Flashcards",
    description:
      "Flip cards with spaced repetition. Rate each card Know It or Still Learning — the algorithm resurfaces what you need.",
    href: "/flashcards",
    color: "from-pink-500/20 to-pink-600/5",
  },
  {
    icon: "🧠",
    title: "Learn Mode",
    description:
      "Read the correct answer and explanation first, then get quizzed on the same batch. Teach-first, test-second.",
    href: "/learn",
    color: "from-teal-500/20 to-teal-600/5",
  },
  {
    icon: "❌",
    title: "Missed Questions",
    description:
      "Review every question you've gotten wrong across all sessions. Sorted by frequency — fix your weak spots.",
    href: "/missed",
    color: "from-red-500/20 to-red-600/5",
  },
  {
    icon: "🗺️",
    title: "Sectional Charts",
    description:
      "High-resolution, pinch-to-zoom charts from the FAA Testing Supplement. No more blurry maps.",
    href: "/charts",
    color: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    icon: "📊",
    title: "Smart Review",
    description:
      "AI detects your weak spots and auto-generates quizzes targeting what you need to practice most.",
    href: "/study?type=weak_spots",
    color: "from-amber-500/20 to-amber-600/5",
  },
];

const LATEST_SOURCE_PACK_AUDIT_YEAR = (() => {
  const auditYears = SOURCE_PACK_REGISTRY.map((entry) => new Date(entry.lastAuditDate).getFullYear()).filter(
    (year) => Number.isFinite(year)
  );
  if (auditYears.length === 0) return new Date().getFullYear();
  return Math.max(...auditYears);
})();
const EXAM_MINUTES = Math.round(EXAM_DEFAULTS.TIME_LIMIT_MS / 60000);
const EXAM_HOURS = Math.round((EXAM_MINUTES / 60) * 10) / 10;

function normalizeStudyCategoryValue(value: string): StudyCategory {
  return (STUDY_CATEGORIES as readonly string[]).includes(value) ? (value as StudyCategory) : "All";
}

export default function HomePage() {
  const activeUserId = useActiveUserId();
  const { questions: allQuestions } = useQuestionBank();
  const { logEvent } = useLearningEventLogger(activeUserId);
  const [practiceType, setPracticeType] = useState<QuestionTypeProfile>("confirmed_test");
  const [defaultStudyCategory, setDefaultStudyCategory] = useState<StudyCategory>("All");
  const [defaultExamCategory, setDefaultExamCategory] = useState<StudyCategory>("All");
  const [defaultLearnBatchSize, setDefaultLearnBatchSize] = useState(5);
  const [defaultFlashcardDailyReviewTarget, setDefaultFlashcardDailyReviewTarget] = useState(20);
  const [weeklyStudyGoalSessions, setWeeklyStudyGoalSessions] = useState(5);
  const [weeklyExamGoalSessions, setWeeklyExamGoalSessions] = useState(2);
  const [learningPrefsHydratedForUserId, setLearningPrefsHydratedForUserId] = useState<string | null>(
    null
  );

  // Initialize with null to avoid server/client hydration mismatch caused by Date.now()
  const [weeklyProgress, setWeeklyProgress] = useState<{ studySessions: number, examSessions: number } | null>(null);
  const topicCounts = useMemo(() => countQuestionsByCategory(allQuestions), [allQuestions]);
  const totalQuestions = topicCounts.All ?? allQuestions.length;
  const stats = useMemo(
    () => [
      { label: "Questions", value: String(totalQuestions), sub: "Live loaded question bank" },
      {
        label: "Pass Rate",
        value: `${EXAM_DEFAULTS.PASSING_PERCENT}%`,
        sub: `${EXAM_DEFAULTS.PASSING_COUNT} of ${FULL_EXAM_QUESTION_COUNT} to pass`,
      },
      { label: "Time Limit", value: `${EXAM_HOURS} hrs`, sub: `${EXAM_MINUTES} minutes on exam day` },
      { label: "Updated", value: String(LATEST_SOURCE_PACK_AUDIT_YEAR), sub: "Source-pack audit year" },
    ],
    [totalQuestions]
  );
  const practiceExamHref = useMemo(() => {
    const params = new URLSearchParams({ type: practiceType });
    if (defaultExamCategory !== "All") {
      params.set("category", defaultExamCategory);
    }
    return `/exam?${params.toString()}`;
  }, [defaultExamCategory, practiceType]);
  const studyHref = useMemo(() => {
    const params = new URLSearchParams({ type: practiceType });
    if (defaultStudyCategory !== "All") {
      params.set("category", defaultStudyCategory);
    }
    return `/study?${params.toString()}`;
  }, [defaultStudyCategory, practiceType]);
  const studyBookmarksHref = useMemo(
    () => {
      const params = new URLSearchParams({ collection: "bookmarks", type: practiceType });
      if (defaultStudyCategory !== "All") {
        params.set("category", defaultStudyCategory);
      }
      return `/study?${params.toString()}`;
    },
    [defaultStudyCategory, practiceType]
  );
  const examBookmarksHref = useMemo(
    () => {
      const params = new URLSearchParams({ collection: "bookmarks", type: practiceType });
      if (defaultExamCategory !== "All") {
        params.set("category", defaultExamCategory);
      }
      return `/exam?${params.toString()}`;
    },
    [defaultExamCategory, practiceType]
  );

  useEffect(() => {
    const preferred = readPreferredQuestionType(activeUserId);
    if (preferred) {
      setPracticeType(preferred);
    }
  }, [activeUserId]);

  useEffect(() => {
    const preferences = readLearningPreferences(activeUserId);
    setDefaultStudyCategory(preferences.defaultStudyCategory);
    setDefaultExamCategory(preferences.defaultExamCategory);
    setDefaultLearnBatchSize(preferences.defaultLearnBatchSize);
    setDefaultFlashcardDailyReviewTarget(preferences.defaultFlashcardDailyReviewTarget);
    setWeeklyStudyGoalSessions(preferences.weeklyStudyGoalSessions);
    setWeeklyExamGoalSessions(preferences.weeklyExamGoalSessions);
    setWeeklyProgress(readWeeklyGoalProgress(activeUserId));
    setLearningPrefsHydratedForUserId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    writePreferredQuestionType(activeUserId, practiceType);
  }, [activeUserId, practiceType]);

  useEffect(() => {
    if (learningPrefsHydratedForUserId !== activeUserId) return;
    writeLearningPreferences(activeUserId, {
      defaultStudyCategory,
      defaultExamCategory,
      defaultLearnBatchSize,
      defaultFlashcardDailyReviewTarget,
      weeklyStudyGoalSessions,
      weeklyExamGoalSessions,
    });
  }, [
    activeUserId,
    defaultFlashcardDailyReviewTarget,
    defaultExamCategory,
    defaultLearnBatchSize,
    defaultStudyCategory,
    learningPrefsHydratedForUserId,
    weeklyExamGoalSessions,
    weeklyStudyGoalSessions,
  ]);

  useEffect(() => {
    logEvent({
      type: "page_view",
      mode: "home",
      metadata: {
        route: "/",
      },
    });
  }, [logEvent]);

  const logNavigation = (target: string, href: string) => {
    logEvent({
      type: "link_opened",
      mode: "home",
      metadata: {
        target,
        href,
      },
    });
  };

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-500">
          <span>✈️</span>
          <span>Updated for 2026 FAA Rules</span>
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
          Pass Your{" "}
          <span className="bg-gradient-to-r from-brand-500 to-cyan-400 bg-clip-text text-transparent">
            Part 107
          </span>{" "}
          Exam
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Free FAA Remote Pilot exam prep with instant feedback, detailed
          explanations, high-res charts, and AI-powered tutoring. Built by a
          pilot, for pilots.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={studyHref}
            onClick={() => logNavigation("hero_start_study", studyHref)}
            className="rounded-xl bg-brand-600 px-8 py-3 font-semibold text-white transition-all hover:bg-brand-700 hover:scale-105"
          >
            Start Studying →
          </Link>
          <Link
            href={practiceExamHref}
            onClick={() => logNavigation("hero_take_exam", practiceExamHref)}
            className="rounded-xl border border-[var(--card-border)] px-8 py-3 font-semibold text-[var(--muted)] transition-all hover:border-white/30 hover:text-white"
          >
            Take Practice Exam
          </Link>
        </div>
        <div className="mx-auto mt-4 max-w-xl space-y-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-left">
          <label htmlFor="practice-type" className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Practice Question Type
          </label>
          <select
            id="practice-type"
            value={practiceType}
            onChange={(event) => {
              const value = event.target.value as QuestionTypeProfile;
              setPracticeType(value);
              logEvent({
                type: "filter_changed",
                mode: "home",
                questionTypeProfile: value,
                metadata: {
                  filter: "practice_type",
                  value,
                },
              });
            }}
            className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-brand-500/60 focus:outline-none"
          >
            {QUESTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--muted)]">
            {QUESTION_TYPE_OPTIONS.find((option) => option.value === practiceType)?.description}
          </p>
          <p className="text-xs text-[var(--muted)]/80">
            Selected: <span className="text-brand-400">{QUESTION_TYPE_PROFILE_LABELS[practiceType]}</span>
          </p>
          <p className="text-xs text-[var(--muted)]/80">
            UAG format is 60 questions, 2.0 hours, 70% passing. ACS codes appear on AKTR after testing to identify deficient areas.
          </p>
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Default Study Category</span>
              <select
                value={defaultStudyCategory}
                onChange={(event) =>
                  setDefaultStudyCategory(normalizeStudyCategoryValue(event.target.value))
                }
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white"
              >
                {STUDY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Default Exam Category</span>
              <select
                value={defaultExamCategory}
                onChange={(event) =>
                  setDefaultExamCategory(normalizeStudyCategoryValue(event.target.value))
                }
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white"
              >
                {STUDY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Learn batch default
              </div>
              <div className="flex flex-wrap gap-1">
                {[3, 5, 10, 15, 20].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDefaultLearnBatchSize(value)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${defaultLearnBatchSize === value
                      ? "border-brand-400 bg-brand-500/20 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Flashcards daily target
              </div>
              <div className="flex flex-wrap gap-1">
                {[10, 20, 30, 50].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDefaultFlashcardDailyReviewTarget(value)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${defaultFlashcardDailyReviewTarget === value
                      ? "border-brand-400 bg-brand-500/20 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            Weekly goals (last 7 days): Study {weeklyProgress?.studySessions ?? 0}/{weeklyStudyGoalSessions} / Exam{" "}
            {weeklyProgress?.examSessions ?? 0}/{weeklyExamGoalSessions}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Study goal / week</div>
              <div className="flex flex-wrap gap-1">
                {[3, 5, 7, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWeeklyStudyGoalSessions(value)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${weeklyStudyGoalSessions === value
                      ? "border-brand-400 bg-brand-500/20 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Exam goal / week</div>
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2, 3, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWeeklyExamGoalSessions(value)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${weeklyExamGoalSessions === value
                      ? "border-brand-400 bg-brand-500/20 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1 text-xs">
            <Link
              href={studyBookmarksHref}
              onClick={() => logNavigation("hero_study_bookmarks", studyBookmarksHref)}
              className="text-brand-400 hover:text-brand-300"
            >
              Study Bookmarks →
            </Link>
            <Link
              href={examBookmarksHref}
              onClick={() => logNavigation("hero_exam_bookmarks", examBookmarksHref)}
              className="text-brand-400 hover:text-brand-300"
            >
              Exam from Bookmarks →
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm font-medium text-[var(--muted)]">
              {stat.label}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]/60">
              {stat.sub}
            </div>
          </div>
        ))}
      </section>

      {/* Feature Cards */}
      <section>
        <h2 className="mb-6 text-2xl font-bold">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              onClick={() => logNavigation(`feature_${feature.title.toLowerCase().replaceAll(/\s+/g, "_")}`, feature.href)}
              className={`group rounded-2xl border border-[var(--card-border)] bg-gradient-to-br ${feature.color} p-6 transition-all hover:border-white/20 hover:scale-[1.02]`}
            >
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {feature.description}
              </p>
              <div className="mt-4 text-sm font-medium text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
                Get Started →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Category Preview */}
      <section>
        <h2 className="mb-2 text-2xl font-bold">Topics Covered</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Click any topic to jump straight into studying or testing that section.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Regulations", icon: "⚖️", sub: "Operating Rules, Registration, Remote ID, Night Ops, Ops Over People, Waivers" },
            { name: "Airspace", icon: "🗺️", sub: "Classification, Special Use, TFRs, MOAs, NOTAMs, ATC Authorization" },
            { name: "Weather", icon: "🌤️", sub: "METARs, TAFs, Density Altitude, Stable/Unstable Air, Wind Shear, Fog" },
            { name: "Operations", icon: "🛩️", sub: "Airport Ops, ADM, Emergency, Radio Comms, Physiology, Maintenance, CRM" },
            { name: "Loading & Performance", icon: "⚙️", sub: "Load Factors, Stalls, Weight & Balance, CG Limits, Performance Charts" },
          ].map((topic) => (
            <div
              key={topic.name}
              className="group rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 transition-all hover:border-brand-500/40 hover:bg-brand-500/5"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{topic.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">
                    {topic.name}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {topicCounts[topic.name as keyof typeof topicCounts] ?? 0} questions
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]/70 leading-relaxed">
                {topic.sub}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/study?category=${encodeURIComponent(topic.name)}&type=${encodeURIComponent(practiceType)}`}
                  onClick={() =>
                    logNavigation(
                      `topic_study_${topic.name.toLowerCase().replaceAll(/\s+/g, "_")}`,
                      `/study?category=${encodeURIComponent(topic.name)}&type=${encodeURIComponent(practiceType)}`
                    )
                  }
                  className="flex-1 rounded-lg bg-brand-600/80 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-brand-600"
                >
                  📖 Study
                </Link>
                <Link
                  href={`/exam?category=${encodeURIComponent(topic.name)}&type=${encodeURIComponent(practiceType)}`}
                  onClick={() =>
                    logNavigation(
                      `topic_exam_${topic.name.toLowerCase().replaceAll(/\s+/g, "_")}`,
                      `/exam?category=${encodeURIComponent(topic.name)}&type=${encodeURIComponent(practiceType)}`
                    )
                  }
                  className="flex-1 rounded-lg border border-[var(--card-border)] py-2 text-center text-xs font-semibold text-[var(--muted)] transition-all hover:border-white/30 hover:text-white"
                >
                  🎯 Test
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
