import { useState } from "react";

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
      const response = await fetch(
        `http://localhost:8080/api/quizzes/${quizId}/questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to create question");
      }
      const createdQuestion = await response.json();
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
      <form className="create-form" onSubmit={handleSubmit}>
        <h2>Create Question</h2>
        <input
          type="text"
          placeholder="Question text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="primary-button" type="submit">
          Create Question
        </button>
      </form>
    </div>
  );
}

export default CreateQuestionForm;
