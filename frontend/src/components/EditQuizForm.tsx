import { useState } from "react";
import { apiPatch, ApiError } from "../api/client";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

type EditQuizFormProps = {
  quiz: Quiz;
  onQuizUpdated: (quiz: Quiz) => void;
};

function EditQuizForm({ quiz, onQuizUpdated }: EditQuizFormProps) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = title !== quiz.title || description !== quiz.description;

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
      setIsSaving(true);
      const updatedQuiz = await apiPatch<Quiz>(`/api/quizzes/${quiz.id}`, {
        title,
        description,
      });
      onQuizUpdated(updatedQuiz);
    } catch (err) {
      console.error("Error updating quiz:", err);
      setError(err instanceof ApiError ? err.message : "Failed to save quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {error && <p className="m-0 text-red-600">{error}</p>}
      <label className="flex flex-col gap-1 text-sm font-bold text-muted">
        Title
        <input
          className="field w-full"
          value={title}
          disabled={isSaving}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold text-muted">
        Description
        <textarea
          className="field min-h-20 w-full resize-y"
          value={description}
          disabled={isSaving}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <button
        className="btn-primary self-start disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        disabled={!isDirty || isSaving}
      >
        {isSaving ? "Saving..." : "Save quiz details"}
      </button>
    </form>
  );
}

export default EditQuizForm;
