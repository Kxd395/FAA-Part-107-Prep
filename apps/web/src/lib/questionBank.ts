import {
  STUDY_CATEGORIES,
  filterQuestionsByCategory,
  shuffleQuestions,
  type Question,
  type StudyCategory,
} from "@part107/core";

import regulationsData from "../../../../packages/content/questions/regulations.json";
import airspaceData from "../../../../packages/content/questions/airspace.json";
import weatherData from "../../../../packages/content/questions/weather.json";
import operationsData from "../../../../packages/content/questions/operations.json";
import loadingPerformanceData from "../../../../packages/content/questions/loading_performance.json";

export type AppQuestion = Question;

export { STUDY_CATEGORIES };
export type { StudyCategory };

export const ALL_QUESTIONS: AppQuestion[] = [
  ...(regulationsData as AppQuestion[]),
  ...(airspaceData as AppQuestion[]),
  ...(weatherData as AppQuestion[]),
  ...(operationsData as AppQuestion[]),
  ...(loadingPerformanceData as AppQuestion[]),
];

export function getQuestionsForCategory(category: StudyCategory): AppQuestion[] {
  return filterQuestionsByCategory(ALL_QUESTIONS, category) as AppQuestion[];
}

export function buildStudyQuestionSet(category: StudyCategory): AppQuestion[] {
  return shuffleQuestions(getQuestionsForCategory(category));
}
