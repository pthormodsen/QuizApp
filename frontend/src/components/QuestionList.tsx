import { useEffect, useState } from "react";
import AnswerOptionForm, { type AnswerOption } from "./AnswerOptionForm";
import { apiGet, apiPatch } from "../api/client";

type Question = {
  id: number;
  text: string;
};

function QuestionItem({ question }: { question: Question }) {
  const [expanded, setExpanded] = useState(false);
  const [answerOptions, setAnswerOptions] = useState<AnswerOption[]>([]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    let cancelled = false;

    async function fetchAnswerOptions() {
      try {
        const result = await apiGet<AnswerOption[]>(
          `/api/questions/${question.id}/answers`,
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
  }, [expanded, question.id]);

  const toggleCorrect = async (answerOption: AnswerOption) => {
    const nextCorrect = !answerOption.correct;

    try {
      const updated = await apiPatch<AnswerOption>(
        `/api/questions/${question.id}/answers/${answerOption.id}`,
        { correct: nextCorrect },
      );
      setAnswerOptions((current) =>
        current.map((option) => (option.id === updated.id ? updated : option)),
      );
    } catch (error) {
      console.error("Error updating answer option:", error);
    }
  };

  return (
    <div className="border-t border-[#eef1ff] py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 font-bold">{question.text}</p>
        <button
          className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Hide answers" : "Manage answers"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5">
          {answerOptions.length === 0 ? (
            <p className="mb-2.5 text-[#5a6275]">No answers yet.</p>
          ) : (
            <ul className="m-0 mb-2.5 flex list-none flex-col gap-1 p-0">
              {answerOptions.map((answerOption) => (
                <li key={answerOption.id}>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={answerOption.correct}
                      onChange={() => toggleCorrect(answerOption)}
                    />
                    {answerOption.text}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <AnswerOptionForm
            questionId={question.id}
            onAnswerOptionCreated={(answerOption) =>
              setAnswerOptions((current) => [...current, answerOption])
            }
          />
        </div>
      )}
    </div>
  );
}

function QuestionList({ questions }: { questions: Question[] }) {
  return (
    <div>
      <h2>Questions</h2>
      {questions.length === 0 ? (
        <p>No questions yet. Add the first one!</p>
      ) : (
        questions.map((question) => (
          <QuestionItem key={question.id} question={question} />
        ))
      )}
    </div>
  );
}

export default QuestionList;
