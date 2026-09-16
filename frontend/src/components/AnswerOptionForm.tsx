import { useState } from "react";
import { apiPost, ApiError } from "../api/client";

type AnswerOption = {
  id: number;
  text: string;
  correct: boolean;
};

type AnswerOptionFormProps = {
  questionId: number;
  onAnswerOptionCreated: (answerOption: AnswerOption) => void;
};

function AnswerOptionForm({
  questionId,
  onAnswerOptionCreated,
}: AnswerOptionFormProps) {
  const [text, setText] = useState("");
  const [correct, setCorrect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (text.trim() === "") {
      setError("Answer text is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const createdAnswerOption = await apiPost<AnswerOption>(
        `/api/questions/${questionId}/answers`,
        { text, correct },
      );
      onAnswerOptionCreated(createdAnswerOption);
      setText("");
      setCorrect(false);
    } catch (err) {
      console.error("Error creating answer option:", err);
      setError(err instanceof ApiError ? err.message : "Failed to add answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={handleSubmit}
    >
      {error && <p className="m-0 text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          className="field min-w-[160px] flex-1 px-2.5 py-2"
          type="text"
          placeholder="Answer text"
          value={text}
          disabled={isSubmitting}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={correct}
            disabled={isSubmitting}
            onChange={(e) => setCorrect(e.target.checked)}
          />
          Correct
        </label>
        <button
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding..." : "Add answer"}
        </button>
      </div>
    </form>
  );
}

export default AnswerOptionForm;
export type { AnswerOption };
