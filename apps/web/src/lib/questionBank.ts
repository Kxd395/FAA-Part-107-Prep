import { STUDY_CATEGORIES, type Question, type StudyCategory } from "@part107/core";

export type AppQuestion = Question;
export { STUDY_CATEGORIES };
export type { StudyCategory };

export interface QuestionApiResponse {
  questions: AppQuestion[];
  meta: {
    total: number;
    category: string;
    shuffled: boolean;
    limit: number | null;
    source: "remote" | "local";
  };
}

interface FetchQuestionsOptions {
  category?: string;
  shuffle?: boolean;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchQuestions({
  category = "All",
  shuffle = false,
  limit,
  signal,
}: FetchQuestionsOptions = {}): Promise<QuestionApiResponse> {
  const params = new URLSearchParams();
  params.set("category", category);
  if (shuffle) params.set("shuffle", "1");
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(limit));
  }

  const response = await fetch(`/api/questions?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch questions (${response.status})`);
  }

  return (await response.json()) as QuestionApiResponse;
}

export function countQuestionsByCategory(allQuestions: readonly AppQuestion[]) {
  return STUDY_CATEGORIES.reduce<Record<StudyCategory, number>>((acc, category) => {
    if (category === "All") {
      acc[category] = allQuestions.length;
      return acc;
    }

    acc[category] = allQuestions.filter((q) => q.category === category).length;
    return acc;
  }, {} as Record<StudyCategory, number>);
}
