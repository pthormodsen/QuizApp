// Shared API response shapes for the study set feature. Mirrors the backend
// records in no.patreek.quiz.dto.studyset.

export type StudySet = {
  id: number;
  title: string;
  description: string | null;
  termCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Term = {
  id: number;
  term: string;
  definition: string;
  orderIndex: number;
};
