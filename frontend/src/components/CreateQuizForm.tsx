import { useState } from "react";
import { apiPost } from "../api/client";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

type CreateQuizFormProps = {
  onCancel: () => void;
  onQuizCreated: (quiz: Quiz) => void;
};

function CreateQuizForm({ onCancel, onQuizCreated }: CreateQuizFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim() === "") {
      alert("Title is required");
      return;
    }
    if (description.trim() === "") {
      alert("Description is required");
      return;
    }
    //console.log(title, description);
    await submitForm();
    clearForm();
  };

  const submitForm = async () => {
    try {
      const createdQuiz = await apiPost<Quiz>("/api/quizzes", { title, description });
      onQuizCreated(createdQuiz);
      console.log("Quiz created successfully");
    } catch (error) {
      console.error("Error creating quiz:", error);
    }
  };

  const clearForm = () => {
    setTitle("");
    setDescription("");
  };

  return (
    <form
      className="mb-6 flex max-w-[520px] flex-col gap-3 rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]"
      onSubmit={handleSubmit}
    >
      <h2 className="m-0">Create Quiz</h2>
      <input
        className="w-full rounded-md border border-[#cfd5e6] px-3 py-[11px]"
        placeholder="Quiz title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="min-h-24 w-full resize-y rounded-md border border-[#cfd5e6] px-3 py-[11px]"
        placeholder="Quiz description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap gap-2.5">
        <button
          className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
          type="submit"
        >
          Create quiz
        </button>
        <button
          className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default CreateQuizForm;
