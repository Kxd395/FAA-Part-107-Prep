"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  QUESTION_TYPE_PROFILE_LABELS,
  type QuestionTypeProfile,
} from "@part107/core";
import { useLearningEventLogger } from "../hooks/useLearningEventLogger";
import { LOCAL_USER_ID } from "../lib/analyticsTaxonomy";

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
  {
    icon: "🔤",
    title: "NATO Phonetic Alphabet",
    description:
      "Flip-card drill for all 26 letters + digits. Word, pronunciation, and Morse code. Not on the exam — essential on the radio.",
    href: "/phonetic",
    color: "from-violet-500/20 to-violet-600/5",
  },
];

const STATS = [
  { label: "Questions", value: "85", sub: "Direct exam-style question set" },
  { label: "Pass Rate", value: "70%", sub: "42 of 60 to pass" },
  { label: "Time Limit", value: "2 hrs", sub: "120 minutes on exam day" },
  { label: "Updated", value: "2026", sub: "Remote ID & Ops Over People" },
];

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "confirmed_test",
    title: "✅ Confirmed Test Questions",
    description: "Only questions verified from the real FAA exam — Review.md, UAG, and SPA banks (74 questions).",
  },
  {
    value: "all_random",
    title: "🎲 All Questions (Random)",
    description: "Full 85-question direct exam-style pool.",
  },
  {
    value: "real_exam",
    title: "Real Exam MCQ (Legacy)",
    description: "Standard FAA-style MCQs only. Excludes ACS code-mapping drill format questions.",
  },
  {
    value: "weak_spots",
    title: "🔥 Weak Spots Only",
    description: "Targets realistic MCQs you miss most often.",
  },
];

export default function HomePage() {
  const { logEvent } = useLearningEventLogger(LOCAL_USER_ID);
  const [practiceType, setPracticeType] = useState<QuestionTypeProfile>("confirmed_test");
  const practiceExamHref = useMemo(() => `/exam?type=${encodeURIComponent(practiceType)}`, [practiceType]);
  const studyHref = useMemo(() => `/study?type=${encodeURIComponent(practiceType)}`, [practiceType]);

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
        </div>
      </section>

      {/* Stats Bar */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat) => (
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
            { name: "Regulations", icon: "⚖️", count: 150, sub: "Operating Rules, Registration, Remote ID, Night Ops, Ops Over People, Waivers" },
            { name: "Airspace", icon: "🗺️", count: 60, sub: "Classification, Special Use, TFRs, MOAs, NOTAMs, ATC Authorization" },
            { name: "Weather", icon: "🌤️", count: 37, sub: "METARs, TAFs, Density Altitude, Stable/Unstable Air, Wind Shear, Fog" },
            { name: "Operations", icon: "🛩️", count: 100, sub: "Airport Ops, ADM, Emergency, Radio Comms, Physiology, Maintenance, CRM" },
            { name: "Loading & Performance", icon: "⚙️", count: 15, sub: "Load Factors, Stalls, Weight & Balance, CG Limits, Performance Charts" },
          ].map((topic) => (            <div
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
                    {topic.count} questions
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

      {/* Quick Drills — standalone tools not tied to the exam question bank */}
      <section>
        <h2 className="mb-2 text-2xl font-bold">Quick Drills</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Reference tools and flash-card drills that aren&apos;t part of the exam question bank.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/phonetic"
            onClick={() => logNavigation("quick_drill_phonetic", "/phonetic")}
            className="group rounded-2xl border border-[var(--card-border)] bg-gradient-to-br from-violet-500/20 to-violet-600/5 p-6 transition-all hover:border-white/20 hover:scale-[1.02]"
          >
            <div className="text-3xl">🔤</div>
            <h3 className="mt-3 text-lg font-semibold text-white">NATO Phonetic Alphabet</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              26 letters · 10 digits · pronunciation guide · Morse code.
              Flip-card, quick quiz, and reference table.
            </p>
            <p className="mt-2 text-xs text-violet-400/80">Not on the MCQ exam — essential on the radio.</p>
            <div className="mt-4 text-sm font-medium text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
              Start Drilling →
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
