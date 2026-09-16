import { useState } from "react";
import { apiPost, ApiError } from "../api/client";

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (title.trim() === "") {
      setError("Title is required");
      return;
    }
    if (description.trim() === "") {
      setError("Description is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const createdQuiz = await apiPost<Quiz>("/api/quizzes", { title, description });
      onQuizCreated(createdQuiz);
      setTitle("");
      setDescription("");
    } catch (err) {
      console.error("Error creating quiz:", err);
      setError(err instanceof ApiError ? err.message : "Failed to create quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="card mb-6 flex max-w-[520px] flex-col gap-3"
      onSubmit={handleSubmit}
    >
      <h2 className="m-0">Create Quiz</h2>
      {error && <p className="m-0 text-red-600">{error}</p>}
      <input
        className="field w-full"
        placeholder="Quiz title"
        value={title}
        disabled={isSubmitting}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="field min-h-24 w-full resize-y"
        placeholder="Quiz description"
        value={description}
        disabled={isSubmitting}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="button-row">
        <button
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create quiz"}
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default CreateQuizForm;
