import { useState } from "react";
import { apiPost } from "../api/client";

type Question = {
  id: number;
  text: string;
};


type CreateQuestionFormProps = {
  quizId: number;
  onQuestionCreated: (question: Question) => void;
};

function CreateQuestionForm({
  quizId,
  onQuestionCreated,
}: CreateQuestionFormProps) {
  const [text, setText] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "") {
      alert("Question text is required");
      return;
    }
    //console.log(text);
    await submitForm();
    clearForm();
  };

  const submitForm = async () => {
    try {
      const createdQuestion = await apiPost<Question>(
        `/api/quizzes/${quizId}/questions`,
        { text },
      );
      onQuestionCreated(createdQuestion);
      console.log("Question created successfully");
    } catch (error) {
      console.error("Error creating question:", error);
    }
  };

  const clearForm = () => {
    setText("");
  };

  return (
    <div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <h2 className="m-0">Create Question</h2>
        <input
          className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
          type="text"
          placeholder="Question text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="cursor-pointer self-start rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
          type="submit"
        >
          Create Question
        </button>
      </form>
    </div>
  );
}

export default CreateQuestionForm;
