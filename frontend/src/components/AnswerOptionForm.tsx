import { useState } from "react";
import { apiPost } from "../api/client";

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "") {
      alert("Answer text is required");
      return;
    }
    await submitForm();
    clearForm();
  };

  const submitForm = async () => {
    try {
      const createdAnswerOption = await apiPost<AnswerOption>(
        `/api/questions/${questionId}/answers`,
        { text, correct },
      );
      onAnswerOptionCreated(createdAnswerOption);
    } catch (error) {
      console.error("Error creating answer option:", error);
    }
  };

  const clearForm = () => {
    setText("");
    setCorrect(false);
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2.5"
      onSubmit={handleSubmit}
    >
      <input
        className="min-w-[160px] flex-1 rounded-md border border-[#cfd5e6] px-2.5 py-2"
        type="text"
        placeholder="Answer text"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={correct}
          onChange={(e) => setCorrect(e.target.checked)}
        />
        Correct
      </label>
      <button
        className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
        type="submit"
      >
        Add answer
      </button>
    </form>
  );
}

export default AnswerOptionForm;
export type { AnswerOption };
