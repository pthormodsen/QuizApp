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

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    let cancelled = false;

    async function fetchAnswerOptions() {
      try {
        const result = await apiGet<AnswerOption[]>(
          `/api/questions/${currentQuestion.id}/answers`,
        );
        if (!cancelled) {
          setAnswerOptions(result);
        }
      } catch (error) {
        console.error("Failed to fetch answer options:", error);
      }
    }

    fetchAnswerOptions();
    return () => {
      cancelled = true;
    };
  }, [currentQuestion]);

  const selectAnswer = (answerOption: AnswerOption) => {
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

  if (finished) {
    const score = questions.filter(
      (question) => selections[question.id]?.correct,
    ).length;

    return (
      <div className="flex flex-col items-start gap-2.5">
        <span className="text-[13px] font-bold text-[#5d6fe4] uppercase">
          {quiz.title}
        </span>
        <h3>Your score: {score} / {questions.length}</h3>
        <button
          className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
          onClick={restart}
        >
          Try again
        </button>
      </div>
    );
  }

  const selectedOption = selections[currentQuestion.id];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div>
      <p>
        Question {currentQuestionIndex + 1} of {questions.length}
      </p>

      <h3>{currentQuestion.text}</h3>

      {answerOptions.length === 0 ? (
        <p className="mb-2.5 text-[#5a6275]">
          No answers yet for this question.
        </p>
      ) : (
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {answerOptions.map((answerOption) => (
            <li key={answerOption.id}>
              <button
                type="button"
                className={
                  selectedOption?.id === answerOption.id
                    ? "w-full cursor-pointer rounded-md border border-[#5d6fe4] bg-[#eef1ff] px-3.5 py-2.5 text-left font-bold"
                    : "w-full cursor-pointer rounded-md border border-[#cfd5e6] bg-white px-3.5 py-2.5 text-left"
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
          className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentQuestionIndex === 0}
          onClick={() =>
            setCurrentQuestionIndex(currentQuestionIndex - 1)
          }
        >
          Previous
        </button>

        {isLastQuestion ? (
          <button
            className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
            onClick={() => setFinished(true)}
          >
            Finish
          </button>
        ) : (
          <button
            className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
            onClick={() =>
              setCurrentQuestionIndex(currentQuestionIndex + 1)
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
