import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import QuizPlayer from "./QuizPlayer";
import { apiGet } from "../api/client";

vi.mock("../api/client", () => ({
  apiGet: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const quizA = { id: 1, title: "Quiz A", description: "First quiz" };
const quizB = { id: 2, title: "Quiz B", description: "Second quiz" };

beforeEach(() => {
  mockedApiGet.mockReset();
});

describe("QuizPlayer", () => {
  it("never shows a stale question's answers while the next question is loading, and ignores a late-arriving response for the old question", async () => {
    const q1Answers = deferred<unknown[]>();
    const q2Answers = deferred<unknown[]>();

    mockedApiGet.mockImplementation((path: string) => {
      if (path.includes("/questions/101/")) return q1Answers.promise;
      if (path.includes("/questions/102/")) return q2Answers.promise;
      return Promise.reject(new Error("unexpected path " + path));
    });

    const questions = [
      { id: 101, text: "Question one" },
      { id: 102, text: "Question two" },
    ];

    render(<QuizPlayer key={quizA.id} quiz={quizA} questions={questions} />);

    // First question's answers are still loading.
    expect(await screen.findByText("Loading answers...")).toBeInTheDocument();

    // Resolve question one's answers so we can navigate away from it.
    q1Answers.resolve([{ id: 1, text: "Q1 - Answer A", correct: true }]);
    await waitFor(() => expect(screen.getByText("Q1 - Answer A")).toBeInTheDocument());

    // Move to question two before its fetch resolves.
    screen.getByRole("button", { name: "Next" }).click();

    // The previous question's answer must never be shown while question two loads.
    expect(await screen.findByText("Loading answers...")).toBeInTheDocument();
    expect(screen.queryByText("Q1 - Answer A")).not.toBeInTheDocument();

    // Simulate a late, out-of-order response for the question we've already left.
    q1Answers.promise.then(() => {
      // already resolved above; nothing further to do
    });

    // Now resolve question two's answers.
    q2Answers.resolve([{ id: 2, text: "Q2 - Answer B", correct: false }]);

    await waitFor(() => expect(screen.getByText("Q2 - Answer B")).toBeInTheDocument());
    expect(screen.queryByText("Q1 - Answer A")).not.toBeInTheDocument();
  });

  it("resets to the first question with no selections when the parent remounts it for a different quiz", async () => {
    mockedApiGet.mockResolvedValue([{ id: 1, text: "Answer", correct: true }]);

    const questionsA = [
      { id: 201, text: "A - Question one" },
      { id: 202, text: "A - Question two" },
      { id: 203, text: "A - Question three" },
    ];

    const { rerender } = render(
      <QuizPlayer key={quizA.id} quiz={quizA} questions={questionsA} />,
    );

    await screen.findByText("Answer");
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();

    // Navigate forward within quiz A.
    screen.getByRole("button", { name: "Next" }).click();
    await waitFor(() => expect(screen.getByText("Question 2 of 3")).toBeInTheDocument());

    // Switching quizzes remounts QuizPlayer with a new key, exactly as HomePage does.
    const questionsB = [{ id: 301, text: "B - Only question" }];
    rerender(<QuizPlayer key={quizB.id} quiz={quizB} questions={questionsB} />);

    await waitFor(() => expect(screen.getByText("Question 1 of 1")).toBeInTheDocument());
    expect(screen.getByText("B - Only question")).toBeInTheDocument();
  });

  it("does not crash when remounted for a quiz with fewer questions than the one being played", async () => {
    mockedApiGet.mockResolvedValue([{ id: 1, text: "Answer", correct: true }]);

    const longQuiz = [
      { id: 401, text: "Long - Q1" },
      { id: 402, text: "Long - Q2" },
      { id: 403, text: "Long - Q3" },
    ];

    const { rerender } = render(
      <QuizPlayer key={quizA.id} quiz={quizA} questions={longQuiz} />,
    );

    await screen.findByText("Answer");
    screen.getByRole("button", { name: "Next" }).click();
    await waitFor(() => expect(screen.getByText("Question 2 of 3")).toBeInTheDocument());
    screen.getByRole("button", { name: "Next" }).click();
    await waitFor(() => expect(screen.getByText("Question 3 of 3")).toBeInTheDocument());

    const shortQuiz = [{ id: 501, text: "Short - only question" }];

    expect(() =>
      rerender(<QuizPlayer key={quizB.id} quiz={quizB} questions={shortQuiz} />),
    ).not.toThrow();

    await waitFor(() => expect(screen.getByText("Question 1 of 1")).toBeInTheDocument());
  });
});
