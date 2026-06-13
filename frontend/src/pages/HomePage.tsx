import { useState, useEffect } from "react";
import CreateQuestionForm from "../components/CreateQuestionForm";
import CreateQuizForm from "../components/CreateQuizForm";
import QuestionList from "../components/QuestionList";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

type Question = {
  id: number;
  text: string;
};

function HomePage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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

  useEffect(() => {
    const activeQuiz = editingQuiz ?? selectedQuiz;

    if (!activeQuiz) {
      setQuestions([]);
      return;
    }

    const quizId = activeQuiz.id;

    async function fetchQuestions() {
      try {
        const response = await fetch(
          `http://localhost:8080/api/quizzes/${quizId}/questions`,
        );
        const result = await response.json();
        setQuestions(result);
      } catch (error) {
        console.error("Failed to fetch questions:", error);
      }
    }

    fetchQuestions();
  }, [editingQuiz, selectedQuiz]);

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

          <button
            className="primary-button"
            onClick={() => setShowCreateForm(true)}
          >
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

          {selectedQuiz && (
            <div className="quiz-detail">
              <div>
                <span className="detail-label">Selected quiz</span>
                <h2>{selectedQuiz.title}</h2>
                <p>{selectedQuiz.description}</p>
                {questions.length === 0 ? (
                  <p>No questions in this quiz yet.</p>
                ) : (
                  <div>
                    <p>
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </p>

                    <h3>{questions[currentQuestionIndex].text}</h3>

                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() =>
                        setCurrentQuestionIndex(currentQuestionIndex - 1)
                      }
                    >
                      Previous
                    </button>

                    <button
                      disabled={currentQuestionIndex === questions.length - 1}
                      onClick={() =>
                        setCurrentQuestionIndex(currentQuestionIndex + 1)
                      }
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              <button
                className="secondary-button"
                onClick={() => setSelectedQuiz(null)}
              >
                Back
              </button>
            </div>
          )}

          {editingQuiz && (
            <div className="quiz-detail">
              <div>
                <span className="detail-label">Editing quiz</span>
                <h2>{editingQuiz.title}</h2>
                <p>{editingQuiz.description}</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setEditingQuiz(null)}
              >
                Back
              </button>
              <QuestionList questions={questions} />
              <CreateQuestionForm
                quizId={editingQuiz.id}
                onQuestionCreated={(question) => {
                  setQuestions((currentQuestions) => [
                    ...currentQuestions,
                    question,
                  ]);
                }}
              />
            </div>
          )}

          {quizzes.length === 0 ? (
            <div className="empty-state">No quizzes available</div>
          ) : (
            <div className="quiz-grid">
              {quizzes.map((quiz) => (
                <article className="quiz-card" key={quiz.id}>
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description}</p>

                  <div className="card-actions">
                    <button
                      className="primary-button"
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setEditingQuiz(null);
                        setCurrentQuestionIndex(0);
                      }}
                    >
                      Start Quiz
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSelectedQuiz(null);
                        setEditingQuiz(quiz);
                      }}
                    >
                      Edit Quiz
                    </button>
                    <button className="secondary-button">Delete Quiz</button>
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
