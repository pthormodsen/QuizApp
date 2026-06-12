import { useState, useEffect } from "react";
import CreateQuizForm from "../components/CreateQuizForm";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

function HomePage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch("http://localhost:8080/api/quizzes");
        const result = await response.json();
        setQuizzes(result);
      } catch (error) {
        console.error("Failed to fetch:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <p className="loading-message">Loading quizzes...</p>;
  }

  return (
    <div className="page">
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>Quiz App</h1>
            <p>Build, manage and test yourself</p>
          </div>

          <button className="primary-button" onClick={() => setShowCreateForm(true)}>
            Create new quiz
          </button>
        </header>

        {showCreateForm && (
          <CreateQuizForm
            onCancel={() => setShowCreateForm(false)}
            onQuizCreated={(newQuiz) => {
              setQuizzes([...quizzes, newQuiz]);
              setShowCreateForm(false);
            }}
          />
        )}

        <section className="quiz-section">
          <h2>Available Quizzes</h2>

          {quizzes.length === 0 ? (
            <div className="empty-state">No quizzes available</div>
          ) : (
            <div className="quiz-grid">
              {quizzes.map((quiz) => (
                <article className="quiz-card" key={quiz.id}>
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description}</p>

                  <div className="card-actions">
                    <button className="primary-button">Start Quiz</button>
                    <button className="secondary-button">Edit Quiz</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export default HomePage;
