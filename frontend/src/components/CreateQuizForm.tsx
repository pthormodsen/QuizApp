import { useState } from "react";

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
      const response = await fetch("http://localhost:8080/api/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) {
        throw new Error("Failed to create quiz");
      }
      const createdQuiz = await response.json();
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
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Create Quiz</h2>
      <input
        placeholder="Quiz title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Quiz description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="form-actions">
        <button className="primary-button" type="submit">
          Create quiz
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default CreateQuizForm;
