// In dev, hit the backend directly on :8080. In a production build, default to
// a relative path so requests go through the same-origin reverse proxy (nginx)
// that sits in front of both the frontend and backend containers - this avoids
// needing CORS at all in production. Override at build time with VITE_API_BASE_URL.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "");
const TOKEN_KEY = "quizapp_token";
const DEMO_STORAGE_KEY = "quizapp_demo_data";

type DemoQuiz = {
  id: number;
  title: string;
  description: string;
};

type DemoQuestion = {
  id: number;
  quizId: number;
  text: string;
};

type DemoAnswerOption = {
  id: number;
  questionId: number;
  text: string;
  correct: boolean;
};

type DemoData = {
  quizzes: DemoQuiz[];
  questions: DemoQuestion[];
  answers: DemoAnswerOption[];
};

const demoSeedData: DemoData = {
  quizzes: [
    {
      id: 1,
      title: "Frontend Fundamentals",
      description:
        "A quick sample quiz that shows the candidate-facing play flow with realistic web development questions.",
    },
    {
      id: 2,
      title: "Product Thinking",
      description:
        "Example admin content for reviewing how quizzes, questions, and answer options are managed.",
    },
    {
      id: 3,
      title: "API & Security Basics",
      description:
        "A compact technical quiz with enough answers to demonstrate scoring and editing.",
    },
  ],
  questions: [
    { id: 1, quizId: 1, text: "Which React hook is commonly used to run side effects after render?" },
    { id: 2, quizId: 1, text: "What does responsive design primarily improve?" },
    { id: 3, quizId: 1, text: "Why should form submissions prevent the browser default action in a SPA?" },
    { id: 4, quizId: 2, text: "What is the best first step before adding a new feature?" },
    { id: 5, quizId: 2, text: "Which metric best shows users are completing a quiz successfully?" },
    { id: 6, quizId: 3, text: "What should a protected API endpoint verify before returning user data?" },
    { id: 7, quizId: 3, text: "Why is storing JWTs carefully important?" },
  ],
  answers: [
    { id: 1, questionId: 1, text: "useEffect", correct: true },
    { id: 2, questionId: 1, text: "useMemo", correct: false },
    { id: 3, questionId: 1, text: "useId", correct: false },
    { id: 4, questionId: 2, text: "The experience across screen sizes and devices", correct: true },
    { id: 5, questionId: 2, text: "Only the color palette", correct: false },
    { id: 6, questionId: 2, text: "Database indexing speed", correct: false },
    { id: 7, questionId: 3, text: "To keep React in control of navigation and state updates", correct: true },
    { id: 8, questionId: 3, text: "To make passwords optional", correct: false },
    { id: 9, questionId: 4, text: "Understand the user need and current workflow", correct: true },
    { id: 10, questionId: 4, text: "Rewrite the styling system immediately", correct: false },
    { id: 11, questionId: 5, text: "Quiz completion rate", correct: true },
    { id: 12, questionId: 5, text: "Number of unused CSS classes", correct: false },
    { id: 13, questionId: 6, text: "The request is authenticated and belongs to the current user", correct: true },
    { id: 14, questionId: 6, text: "The request has a pretty user agent string", correct: false },
    { id: 15, questionId: 7, text: "A stolen token can allow unauthorized requests", correct: true },
    { id: 16, questionId: 7, text: "JWTs make CSS load slower", correct: false },
  ],
};

class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized: (() => void) | null = null;

function isDemoMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return window.location.pathname === "/demo" || params.get("demo") === "true";
}

function readDemoData(): DemoData {
  const storedData = sessionStorage.getItem(DEMO_STORAGE_KEY);
  if (storedData) {
    return JSON.parse(storedData) as DemoData;
  }

  sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoSeedData));
  return demoSeedData;
}

function writeDemoData(data: DemoData): void {
  sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
}

function resetDemoData(): void {
  sessionStorage.removeItem(DEMO_STORAGE_KEY);
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    onUnauthorized?.();
  }

  return response;
}

async function toApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  try {
    const data = await response.json();
    const message = typeof data?.error === "string" ? data.error : fallbackMessage;
    const fieldErrors =
      data?.fieldErrors && typeof data.fieldErrors === "object" ? data.fieldErrors : undefined;
    return new ApiError(response.status, message, fieldErrors);
  } catch {
    return new ApiError(response.status, fallbackMessage);
  }
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (isDemoMode()) {
    const data = readDemoData();
    const quizQuestionsMatch = path.match(/^\/api\/quizzes\/(\d+)\/questions$/);
    const questionAnswersMatch = path.match(/^\/api\/questions\/(\d+)\/answers$/);
    const quizReadinessMatch = path.match(/^\/api\/quizzes\/(\d+)\/readiness$/);

    if (path === "/api/quizzes") {
      return data.quizzes as T;
    }

    if (quizQuestionsMatch) {
      const quizId = Number(quizQuestionsMatch[1]);
      return data.questions
        .filter((question) => question.quizId === quizId)
        .map(({ id, text }) => ({ id, text })) as T;
    }

    if (questionAnswersMatch) {
      const questionId = Number(questionAnswersMatch[1]);
      return data.answers
        .filter((answer) => answer.questionId === questionId)
        .map(({ id, text, correct }) => ({ id, text, correct })) as T;
    }

    if (quizReadinessMatch) {
      const quizId = Number(quizReadinessMatch[1]);
      const quizQuestions = data.questions.filter((question) => question.quizId === quizId);
      const issues: string[] = [];

      if (quizQuestions.length === 0) {
        issues.push("Add at least one question.");
      }

      quizQuestions.forEach((question) => {
        const answers = data.answers.filter((answer) => answer.questionId === question.id);
        if (answers.length < 2) {
          issues.push(`"${question.text}" needs at least two answers.`);
        }
        if (!answers.some((answer) => answer.correct)) {
          issues.push(`"${question.text}" needs one correct answer.`);
        }
      });

      return { ready: issues.length === 0, issues } as T;
    }
  }

  const response = await apiFetch(path, { signal });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (isDemoMode()) {
    const data = readDemoData();
    const quizQuestionsMatch = path.match(/^\/api\/quizzes\/(\d+)\/questions$/);
    const questionAnswersMatch = path.match(/^\/api\/questions\/(\d+)\/answers$/);

    if (path === "/api/quizzes") {
      const request = body as { title: string; description: string };
      const quiz = {
        id: nextId(data.quizzes),
        title: request.title,
        description: request.description,
      };
      writeDemoData({ ...data, quizzes: [...data.quizzes, quiz] });
      return quiz as T;
    }

    if (quizQuestionsMatch) {
      const request = body as { text: string };
      const question = {
        id: nextId(data.questions),
        quizId: Number(quizQuestionsMatch[1]),
        text: request.text,
      };
      writeDemoData({ ...data, questions: [...data.questions, question] });
      return { id: question.id, text: question.text } as T;
    }

    if (questionAnswersMatch) {
      const request = body as { text: string; correct: boolean };
      const answer = {
        id: nextId(data.answers),
        questionId: Number(questionAnswersMatch[1]),
        text: request.text,
        correct: request.correct,
      };
      writeDemoData({ ...data, answers: [...data.answers, answer] });
      return { id: answer.id, text: answer.text, correct: answer.correct } as T;
    }
  }

  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  if (isDemoMode()) {
    const quizMatch = path.match(/^\/api\/quizzes\/(\d+)$/);
    const questionMatch = path.match(/^\/api\/quizzes\/(\d+)\/questions\/(\d+)$/);
    const questionReorderMatch = path.match(/^\/api\/quizzes\/(\d+)\/questions\/reorder$/);
    const answerMatch = path.match(/^\/api\/questions\/(\d+)\/answers\/(\d+)$/);

    if (quizMatch) {
      const data = readDemoData();
      const quizId = Number(quizMatch[1]);
      const request = body as { title?: string; description?: string };
      const quizzes = data.quizzes.map((quiz) =>
        quiz.id === quizId
          ? {
              ...quiz,
              title: request.title ?? quiz.title,
              description: request.description ?? quiz.description,
            }
          : quiz,
      );
      writeDemoData({ ...data, quizzes });

      const updatedQuiz = quizzes.find((quiz) => quiz.id === quizId);
      if (updatedQuiz) {
        return updatedQuiz as T;
      }
    }

    if (questionMatch) {
      const data = readDemoData();
      const questionId = Number(questionMatch[2]);
      const request = body as { text?: string };
      const questions = data.questions.map((question) =>
        question.id === questionId
          ? { ...question, text: request.text ?? question.text }
          : question,
      );
      writeDemoData({ ...data, questions });

      const updatedQuestion = questions.find((question) => question.id === questionId);
      if (updatedQuestion) {
        return { id: updatedQuestion.id, text: updatedQuestion.text } as T;
      }
    }

    if (questionReorderMatch) {
      const data = readDemoData();
      const quizId = Number(questionReorderMatch[1]);
      const request = body as { questionIds: number[] };
      const quizQuestions = request.questionIds
        .map((id) => data.questions.find((question) => question.id === id && question.quizId === quizId))
        .filter((question): question is DemoQuestion => Boolean(question));
      const otherQuestions = data.questions.filter((question) => question.quizId !== quizId);
      writeDemoData({ ...data, questions: [...otherQuestions, ...quizQuestions] });
      return quizQuestions.map(({ id, text }) => ({ id, text })) as T;
    }

    if (answerMatch) {
      const data = readDemoData();
      const answerId = Number(answerMatch[2]);
      const questionId = Number(answerMatch[1]);
      const request = body as { correct?: boolean; text?: string };
      const answers = data.answers.map((answer) =>
        answer.questionId === questionId && answer.id === answerId
          ? {
              ...answer,
              text: request.text ?? answer.text,
              correct: request.correct ?? answer.correct,
            }
          : request.correct === true && answer.questionId === questionId
            ? { ...answer, correct: false }
            : answer,
      );
      writeDemoData({ ...data, answers });

      const updatedAnswer = answers.find((answer) => answer.id === answerId);
      if (updatedAnswer) {
        return {
          id: updatedAnswer.id,
          text: updatedAnswer.text,
          correct: updatedAnswer.correct,
        } as T;
      }
    }
  }

  const response = await apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiDelete(path: string): Promise<void> {
  if (isDemoMode()) {
    const quizMatch = path.match(/^\/api\/quizzes\/(\d+)$/);
    const questionMatch = path.match(/^\/api\/quizzes\/(\d+)\/questions\/(\d+)$/);
    const answerMatch = path.match(/^\/api\/questions\/(\d+)\/answers\/(\d+)$/);
    const data = readDemoData();

    if (quizMatch) {
      const quizId = Number(quizMatch[1]);
      const questionIds = data.questions
        .filter((question) => question.quizId === quizId)
        .map((question) => question.id);
      writeDemoData({
        quizzes: data.quizzes.filter((quiz) => quiz.id !== quizId),
        questions: data.questions.filter((question) => question.quizId !== quizId),
        answers: data.answers.filter((answer) => !questionIds.includes(answer.questionId)),
      });
      return;
    }

    if (questionMatch) {
      const questionId = Number(questionMatch[2]);
      writeDemoData({
        ...data,
        questions: data.questions.filter((question) => question.id !== questionId),
        answers: data.answers.filter((answer) => answer.questionId !== questionId),
      });
      return;
    }

    if (answerMatch) {
      const answerId = Number(answerMatch[2]);
      writeDemoData({
        ...data,
        answers: data.answers.filter((answer) => answer.id !== answerId),
      });
      return;
    }
  }

  const response = await apiFetch(path, { method: "DELETE" });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
}

export {
  ApiError,
  getToken,
  setToken,
  clearToken,
  setUnauthorizedHandler,
  isDemoMode,
  resetDemoData,
  apiFetch,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
};
