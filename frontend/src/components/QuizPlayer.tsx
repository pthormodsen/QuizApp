import { useEffect, useState } from "react";
import type { AnswerOption } from "./AnswerOptionForm";
import { apiGet } from "../api/client";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

type Question = {
  id: number;
  text: string;
};

type QuizPlayerProps = {
  quiz: Quiz;
  questions: Question[];
};

function QuizPlayer({ quiz, questions }: QuizPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerOptions, setAnswerOptions] = useState<AnswerOption[]>([]);
  const [selections, setSelections] = useState<Record<number, AnswerOption>>(
    {},
  );
  const [finished, setFinished] = useState(false);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // The parent mounts QuizPlayer with key={quiz.id}, so switching quizzes
  // remounts this component and every piece of state above starts fresh
  // instead of needing to be reset manually here.

  const safeIndex =
    questions.length === 0 ? 0 : Math.min(currentQuestionIndex, questions.length - 1);
  const currentQuestion = questions[safeIndex];

  useEffect(() => {
    if (!currentQuestion) {
      // questions is stable for the lifetime of this mount (a new quiz
      // remounts via key), so answerOptions is already [] from initial state.
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchAnswerOptions() {
      setIsLoadingAnswers(true);
      setAnswersError(null);
      // Clear immediately so the previous question's answers can never be
      // shown (or selected) while the next question is loading.
      setAnswerOptions([]);

      try {
        const result = await apiGet<AnswerOption[]>(
          `/api/questions/${currentQuestion.id}/answers`,
          controller.signal,
        );
        if (!cancelled) {
          setAnswerOptions(result);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("Failed to fetch answer options:", error);
        setAnswersError("Couldn't load answers for this question.");
      } finally {
        if (!cancelled) {
          setIsLoadingAnswers(false);
        }
      }
    }

    fetchAnswerOptions();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, retryToken]);

  const selectAnswer = (answerOption: AnswerOption) => {
    if (!currentQuestion) {
      return;
    }
    setSelections((current) => ({
      ...current,
      [currentQuestion.id]: answerOption,
    }));
  };

  const restart = () => {
    setSelections({});
    setCurrentQuestionIndex(0);
    setFinished(false);
  };

  if (questions.length === 0) {
    return <p>No questions in this quiz yet.</p>;
  }

  if (!currentQuestion) {
    return null;
  }

  if (finished) {
    const score = questions.filter(
      (question) => selections[question.id]?.correct,
    ).length;

    return (
      <div className="flex flex-col items-start gap-2.5">
        <span className="eyebrow">{quiz.title}</span>
        <h3>Your score: {score} / {questions.length}</h3>
        <button className="btn-primary" onClick={restart}>
          Try again
        </button>
      </div>
    );
  }

  const selectedOption = selections[currentQuestion.id];
  const isLastQuestion = safeIndex === questions.length - 1;

  return (
    <div>
      <p>
        Question {safeIndex + 1} of {questions.length}
      </p>

      <h3>{currentQuestion.text}</h3>

      {isLoadingAnswers && <p className="mb-2.5 text-muted">Loading answers...</p>}

      {!isLoadingAnswers && answersError && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <p className="m-0 text-red-600">{answersError}</p>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoadingAnswers && !answersError && answerOptions.length === 0 && (
        <p className="mb-2.5 text-muted">
          No answers yet for this question.
        </p>
      )}

      {!isLoadingAnswers && !answersError && answerOptions.length > 0 && (
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {answerOptions.map((answerOption) => (
            <li key={answerOption.id}>
              <button
                type="button"
                className={
                  selectedOption?.id === answerOption.id
                    ? "w-full cursor-pointer rounded-md border border-primary bg-surface px-3.5 py-2.5 text-left font-bold"
                    : "w-full cursor-pointer rounded-md border border-border-input bg-white px-3.5 py-2.5 text-left"
                }
                onClick={() => selectAnswer(answerOption)}
              >
                {answerOption.text}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2.5">
        <button
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={safeIndex === 0}
          onClick={() =>
            setCurrentQuestionIndex(safeIndex - 1)
          }
        >
          Previous
        </button>

        {isLastQuestion ? (
          <button className="btn-primary" onClick={() => setFinished(true)}>
            Finish
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={() =>
              setCurrentQuestionIndex(safeIndex + 1)
            }
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export default QuizPlayer;
