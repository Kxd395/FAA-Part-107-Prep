import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "./page";
import { useProgress } from "../../hooks/useProgress";
import { QUESTION_COLLECTION_STORAGE_KEY } from "../../lib/questionCollectionStore";
import { userScopedStorageKey } from "../../lib/progressStorage";

const useAuthMock = vi.fn();

vi.mock("../../hooks/useProgress", () => ({
  useProgress: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
    clearEvents: vi.fn(),
    getEvents: vi.fn(),
  }),
}));

const PORTABLE_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
  "part107_question_collections_v1",
] as const;

function makeSnapshot(
  overrides: Partial<Record<(typeof PORTABLE_KEYS)[number], string | null>>
) {
  const data: Record<string, string | null> = {};
  for (const key of PORTABLE_KEYS) data[key] = null;
  Object.assign(data, overrides);
  return {
    version: 1 as const,
    exportedAt: "2026-02-24T00:00:00.000Z",
    data,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useAuthMock.mockReset();
  useAuthMock.mockReturnValue({
    user: null,
    loading: false,
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  });
  const mockedUseProgress = vi.mocked(useProgress);
  mockedUseProgress.mockReturnValue({
    loaded: true,
    sessions: [
      {
        id: "session-1",
        mode: "study",
        category: "Regulations",
        score: 1,
        total: 1,
        percentage: 100,
        passed: true,
        timestamp: "2026-02-24T00:00:00.000Z",
        timeSpentMs: 1000,
        questions: [
          {
            questionId: "REG-001",
            userAnswer: "A",
            correctAnswer: "A",
            isCorrect: true,
            category: "Regulations",
          },
        ],
      },
    ],
    saveSession: vi.fn(),
    deleteSession: vi.fn(),
    clearAll: vi.fn(),
    getStats: () => ({
      totalSessions: 1,
      totalQuestions: 1,
      totalCorrect: 1,
      overallAccuracy: 100,
      studySessions: 1,
      examSessions: 0,
      examPassRate: 0,
      bestExamScore: 0,
      currentStreak: 1,
      longestStreak: 1,
      recentTrend: [],
      weakSpots: [],
      categoryBreakdown: [],
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Progress import flows", () => {
  it("renders session momentum analytics (daily streak and trend windows)", async () => {
    render(<ProgressPage />);

    expect(await screen.findByText(/Session Momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Daily Streak/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Trend \(30 days\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Trend \(8 weeks\)/i)).toBeInTheDocument();
  });

  it("applies merge mode by default and keeps newest duplicate session", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "part107_progress",
      JSON.stringify([{ id: "s1", timestamp: "2026-02-20T00:00:00.000Z", score: 40 }])
    );

    const { container } = render(<ProgressPage />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const snapshot = makeSnapshot({
      part107_progress: JSON.stringify([
        { id: "s1", timestamp: "2026-02-22T00:00:00.000Z", score: 75 },
        { id: "s2", timestamp: "2026-02-23T00:00:00.000Z", score: 85 },
      ]),
    });
    const importFile = new File([JSON.stringify(snapshot)], "progress-import.json", {
      type: "application/json",
    });
    Object.defineProperty(importFile, "text", {
      value: async () => JSON.stringify(snapshot),
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [importFile],
      },
    });

    await screen.findByText("Import Preview");
    await user.click(screen.getByRole("button", { name: "Apply Import" }));

    await waitFor(() => {
      const merged = JSON.parse(localStorage.getItem("part107_progress") ?? "[]") as Array<{
        id: string;
        score: number;
      }>;
      expect(merged).toHaveLength(2);
      expect(merged.find((row) => row.id === "s1")?.score).toBe(75);
      expect(merged.find((row) => row.id === "s2")?.score).toBe(85);
    });
  });

  it("applies overwrite mode and replaces existing progress payload", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "part107_progress",
      JSON.stringify([{ id: "s1", timestamp: "2026-02-20T00:00:00.000Z", score: 40 }])
    );

    const { container } = render(<ProgressPage />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const snapshot = makeSnapshot({
      part107_progress: null,
    });
    const importFile = new File([JSON.stringify(snapshot)], "progress-overwrite.json", {
      type: "application/json",
    });
    Object.defineProperty(importFile, "text", {
      value: async () => JSON.stringify(snapshot),
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [importFile],
      },
    });

    await screen.findByText("Import Preview");
    await user.click(screen.getByRole("button", { name: "Overwrite" }));
    await user.click(screen.getByRole("button", { name: "Apply Import" }));

    await waitFor(() => {
      expect(localStorage.getItem("part107_progress")).toBeNull();
    });
  });

  it("enables virtualized history mode for very large session sets", async () => {
    const user = userEvent.setup();
    const mockedUseProgress = vi.mocked(useProgress);
    mockedUseProgress.mockReturnValue({
      loaded: true,
      sessions: Array.from({ length: 320 }, (_, index) => ({
        id: `session-${index}`,
        mode: "study",
        category: "Airspace",
        score: 1,
        total: 1,
        percentage: 100,
        passed: true,
        timestamp: new Date(2026, 1, 24, 0, index % 60).toISOString(),
        timeSpentMs: 1000,
        questions: [
          {
            questionId: `Q-${index}`,
            userAnswer: "A",
            correctAnswer: "A",
            isCorrect: true,
            category: "Airspace",
          },
        ],
      })),
      saveSession: vi.fn(),
      deleteSession: vi.fn(),
      clearAll: vi.fn(),
      getStats: () => ({
        totalSessions: 320,
        totalQuestions: 320,
        totalCorrect: 320,
        overallAccuracy: 100,
        studySessions: 320,
        examSessions: 0,
        examPassRate: 0,
        bestExamScore: 0,
        currentStreak: 320,
        longestStreak: 320,
        recentTrend: [],
        weakSpots: [],
        categoryBreakdown: [],
      }),
    });

    render(<ProgressPage />);
    await user.click(screen.getAllByRole("button", { name: /History/i })[0]);
    expect(await screen.findByText(/Virtualized history view active/i)).toBeInTheDocument();
  });

  it("downloads sync snapshot and opens import preview", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/sync/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "sync-token" }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          userId: "local-user",
          updatedAt: "2026-02-24T00:00:00.000Z",
          snapshot: {
            version: 1,
            exportedAt: "2026-02-24T00:00:00.000Z",
            data: {
              part107_progress: JSON.stringify([{ id: "remote-session", timestamp: "2026-02-24T00:00:00.000Z" }]),
            },
          },
        }),
      } as Response;
    });

    render(<ProgressPage />);
    await user.click(screen.getAllByRole("button", { name: /Download from Sync/i })[0]);

    expect(await screen.findByText(/Downloaded remote snapshot/i)).toBeInTheDocument();
    expect(await screen.findByText(/Import Preview/i)).toBeInTheDocument();
  });

  it("uploads sync snapshot and shows completion status", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/sync/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "sync-token" }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accepted: true,
          mergedSummary: { changedKeys: ["part107_progress"], conflicts: 0 },
          updatedAt: "2026-02-24T00:00:00.000Z",
        }),
      } as Response;
    });

    render(<ProgressPage />);
    await user.click(screen.getAllByRole("button", { name: /Upload to Sync/i })[0]);

    expect(await screen.findByText(/Uploaded successfully/i)).toBeInTheDocument();
  });

  it("refreshes sync session token and retries once on 401 upload", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ authenticated: false, userId: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "expired-token" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid or expired sync session token" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "fresh-token" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accepted: true,
          mergedSummary: { changedKeys: ["part107_progress"], conflicts: 0 },
          updatedAt: "2026-02-24T00:00:00.000Z",
        }),
      } as Response);

    render(<ProgressPage />);
    await user.click(screen.getAllByRole("button", { name: /Upload to Sync/i })[0]);

    expect(await screen.findByText(/Uploaded successfully/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows analytics dead-letter queue count and supports clear", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "part107_analytics_sink_deadletter_v1",
      JSON.stringify([
        {
          payload: {
            event: {
              id: "evt-1",
              userId: "local-user",
              timestamp: "2026-02-24T00:00:00.000Z",
              type: "page_view",
              mode: "progress",
            },
          },
          queuedAt: "2026-02-24T00:00:00.000Z",
          retryCount: 3,
          lastError: "sink down",
        },
      ])
    );

    render(<ProgressPage />);
    expect(await screen.findByText(/Pending: 1/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Clear Queue/i })[0]);
    expect(await screen.findByText(/Pending: 0/i)).toBeInTheDocument();
  });

  it("disables dead-letter retry until nextRetryAt is due", async () => {
    const nextRetryAt = new Date(Date.now() + 60_000).toISOString();
    localStorage.setItem(
      "part107_analytics_sink_deadletter_v1",
      JSON.stringify([
        {
          payload: {
            event: {
              id: "evt-2",
              userId: "local-user",
              timestamp: "2026-02-24T00:00:00.000Z",
              type: "page_view",
              mode: "progress",
            },
          },
          queuedAt: "2026-02-24T00:00:00.000Z",
          retryCount: 4,
          lastError: "sink down",
          nextRetryAt,
        },
      ])
    );

    render(<ProgressPage />);
    const retry = await screen.findByRole("button", { name: /Retry Queue/i });
    expect(retry).toBeDisabled();
    expect(await screen.findByText(/Next retry/i)).toBeInTheDocument();
  });

  it("shows conflict winner summary in import preview", async () => {
    const { container } = render(<ProgressPage />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    localStorage.setItem(
      "part107_progress",
      JSON.stringify([{ id: "existing", timestamp: "2026-02-20T00:00:00.000Z", score: 40 }])
    );
    const snapshot = makeSnapshot({
      part107_progress: JSON.stringify([{ id: "incoming", timestamp: "2026-02-22T00:00:00.000Z", score: 75 }]),
    });
    const importFile = new File([JSON.stringify(snapshot)], "conflict-summary.json", {
      type: "application/json",
    });
    Object.defineProperty(importFile, "text", {
      value: async () => JSON.stringify(snapshot),
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [importFile],
      },
    });

    expect(await screen.findByText(/Conflict winners:/i)).toBeInTheDocument();
    expect(await screen.findByText(/Local 0/i)).toBeInTheDocument();
    expect(await screen.findByText(/Remote 1/i)).toBeInTheDocument();
  });

  it("shows response-time telemetry QA summary and anomaly alert", async () => {
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "local-user": Array.from({ length: 24 }, (_, index) => ({
            attemptId: `a-${index}`,
            userId: "local-user",
            questionKey: `k-${index}`,
            questionId: `Q-${index}`,
            timestamp: "2026-02-24T00:00:00.000Z",
            mode: index % 2 === 0 ? "practice" : "mock",
            correct: index % 3 === 0,
            responseTimeMs: index < 5 ? null : index < 8 ? 0 : 1500 + index * 20,
            selectedOptionId: "A",
            quizId: null,
            topicTags: ["Regulations"],
            difficulty: 2,
            confidence: 3,
          })),
        },
      })
    );

    render(<ProgressPage />);
    expect(await screen.findByText(/Response-Time Telemetry QA/i)).toBeInTheDocument();
    expect(await screen.findByText(/Telemetry anomaly detected/i)).toBeInTheDocument();
  });

  it("renders tracking insights even when no saved sessions exist", async () => {
    const mockedUseProgress = vi.mocked(useProgress);
    mockedUseProgress.mockReturnValue({
      loaded: true,
      sessions: [],
      saveSession: vi.fn(),
      deleteSession: vi.fn(),
      clearAll: vi.fn(),
      getStats: () => ({
        totalSessions: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        studySessions: 0,
        examSessions: 0,
        examPassRate: 0,
        bestExamScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        recentTrend: [],
        weakSpots: [],
        categoryBreakdown: [],
      }),
    });
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "local-user": [
            {
              attemptId: "a-1",
              userId: "local-user",
              questionKey: "k-1",
              questionId: "Q-1",
              timestamp: "2026-02-24T00:00:00.000Z",
              mode: "practice",
              correct: true,
              responseTimeMs: 1800,
              selectedOptionId: "A",
              quizId: null,
              topicTags: ["Regulations"],
              difficulty: 2,
              confidence: 3,
            },
          ],
        },
      })
    );

    render(<ProgressPage />);

    expect(screen.queryByText(/No Progress Yet/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Response-Time Telemetry QA/i)).toBeInTheDocument();
    expect(await screen.findByText(/Tracking data is available even though no full sessions have been saved yet./i)).toBeInTheDocument();
  });

  it("renders authenticated issue triage summary cards and top question rows", async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      user: {
        userId: "pilot-user",
        email: "pilot@example.com",
      },
      loading: false,
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/user/question-issues/summary")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userId: "pilot-user",
            limit: 8,
            generatedAt: "2026-02-26T00:00:00.000Z",
            summary: {
              totalReports: 3,
              uniqueQuestionCount: 2,
              latestReportAt: "2026-02-26T00:00:00.000Z",
              byMode: {
                study: 2,
                exam: 1,
                learn: 0,
                flashcards: 0,
                missed: 0,
                unknown: 0,
              },
              byCategory: {
                Regulations: 2,
                Airspace: 1,
              },
              topQuestions: [
                {
                  questionId: "RID-001",
                  questionText: "When is Remote ID required?",
                  category: "Regulations",
                  subcategory: "Remote ID",
                  reportCount: 2,
                  latestReportAt: "2026-02-26T00:00:00.000Z",
                  latestNote: "Remote ID wording is ambiguous.",
                  byMode: {
                    study: 1,
                    exam: 1,
                    learn: 0,
                    flashcards: 0,
                    missed: 0,
                    unknown: 0,
                  },
                },
              ],
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 404,
        json: async () => ({ error: "No account state found" }),
      } as Response;
    });

    render(<ProgressPage />);
    expect(await screen.findByText(/Issue Triage/i)).toBeInTheDocument();
    expect(await screen.findByText(/Total Reports/i)).toBeInTheDocument();
    expect(await screen.findByText(/Questions Flagged/i)).toBeInTheDocument();
    expect(await screen.findByText(/RID-001/i)).toBeInTheDocument();
    expect(await screen.findByText(/Remote ID wording is ambiguous\./i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Queue for Review/i }));
    expect(await screen.findByText(/RID-001 queued in bookmarks\./i)).toBeInTheDocument();
    const storedCollections = localStorage.getItem(
      userScopedStorageKey(QUESTION_COLLECTION_STORAGE_KEY, "pilot-user")
    );
    expect(storedCollections).toContain("RID-001");
  });
});
