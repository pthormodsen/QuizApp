import { useState } from "react";
import { apiPost, ApiError } from "../api/client";

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (text.trim() === "") {
      setError("Question text is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const createdQuestion = await apiPost<Question>(
        `/api/quizzes/${quizId}/questions`,
        { text },
      );
      onQuestionCreated(createdQuestion);
      setText("");
    } catch (err) {
      console.error("Error creating question:", err);
      setError(err instanceof ApiError ? err.message : "Failed to create question. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <h2 className="m-0">Create Question</h2>
        {error && <p className="m-0 text-red-600">{error}</p>}
        <input
          className="field w-full"
          type="text"
          placeholder="Question text"
          value={text}
          disabled={isSubmitting}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="btn-primary self-start disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Question"}
        </button>
      </form>
    </div>
  );
}

export default CreateQuestionForm;
