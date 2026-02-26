import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRateLimitStoreForTests } from "../../../lib/server/rateLimit";

import { GET } from "./route";

function normalizeOptionText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^[a-d][).:-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function questionSignature(question: {
  question_text?: unknown;
  options?: Array<{ text?: unknown }>;
  correct_option_id?: unknown;
}): string {
  const stem = String(question.question_text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const options = Array.isArray(question.options)
    ? question.options.map((option) => normalizeOptionText(option?.text))
    : [];
  const answer = String(question.correct_option_id ?? "").trim().toUpperCase();
  return [stem, ...options, answer].join("||");
}

describe("GET /api/questions", () => {
  const originalEnv = process.env.QUESTION_SOURCE_URL;

  afterEach(() => {
    process.env.QUESTION_SOURCE_URL = originalEnv;
    clearRateLimitStoreForTests();
    vi.restoreAllMocks();
  });

  it("returns local questions payload by default", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const request = new NextRequest("http://localhost/api/questions?category=All&limit=5");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBeLessThanOrEqual(5);
    expect(body.meta.source).toBe("local");
  });

  it("returns canonical local bank with no duplicate IDs/signatures", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const response = await GET(new NextRequest("http://localhost/api/questions?category=All"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.source).toBe("local");
    expect(body.questions.length).toBeGreaterThanOrEqual(100);
    expect(body.questions.length).toBeLessThanOrEqual(500);

    const nonStrictCarrington = body.questions.filter((question: { source?: string }) =>
      String(question.source ?? "").toLowerCase().startsWith("carrington-question-bank") &&
      !String(question.source ?? "").toLowerCase().startsWith("carrington-question-bank-strict")
    );
    expect(nonStrictCarrington).toHaveLength(0);

    const ids = body.questions.map((question: { id?: string }) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    const signatures = body.questions.map((question: { question_text?: string; options?: Array<{ text?: string }>; correct_option_id?: string }) =>
      questionSignature(question)
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("returns 500 for malformed remote payload", async () => {
    process.env.QUESTION_SOURCE_URL = "https://example.test/questions";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ questions: [{ id: "bad" }] }),
    } as Response);

    const request = new NextRequest("http://localhost/api/questions?category=All");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(String(body.error)).toMatch(/invalid|question/i);
  });

  it("uses remote payload when valid", async () => {
    process.env.QUESTION_SOURCE_URL = "https://example.test/questions";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        questions: [
          {
            id: "Q-remote-1",
            category: "Airspace",
            subcategory: "Class C",
            question_text: "Remote question",
            figure_reference: null,
            options: [
              { id: "A", text: "A" },
              { id: "B", text: "B" },
              { id: "C", text: "C" },
              { id: "D", text: "D" },
            ],
            correct_option_id: "A",
            explanation_correct: "Because",
            explanation_distractors: {},
            citation: "14 CFR 107.41",
            difficulty_level: 1,
            tags: [],
          },
        ],
      }),
    } as Response);

    const request = new NextRequest("http://localhost/api/questions?category=All");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.source).toBe("remote");
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].id).toBe("Q-remote-1");
  });

  it("normalizes unknown category to All and returns category metadata", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const request = new NextRequest("http://localhost/api/questions?category=unknown-category");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.category).toBe("All");
    expect(body.questions.length).toBeGreaterThan(0);
  });

  it("treats invalid limit values as null", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const request = new NextRequest("http://localhost/api/questions?category=All&limit=-5");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.limit).toBeNull();
  });

  it("caps large limits to 500", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const request = new NextRequest("http://localhost/api/questions?category=All&limit=99999");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.limit).toBe(500);
    expect(body.questions.length).toBeLessThanOrEqual(500);
  });

  it("marks shuffle metadata when shuffle query param is enabled", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    const request = new NextRequest("http://localhost/api/questions?category=All&shuffle=true&limit=10");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.shuffled).toBe(true);
    expect(body.questions).toHaveLength(10);
  });

  it("returns 429 when request rate limit is exceeded", async () => {
    delete process.env.QUESTION_SOURCE_URL;
    let response: Response | null = null;
    for (let i = 0; i < 181; i += 1) {
      const request = new NextRequest("http://localhost/api/questions?category=All", {
        headers: { "x-forwarded-for": "test-rate-limit-ip" },
      });
      response = await GET(request);
    }

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });
});
