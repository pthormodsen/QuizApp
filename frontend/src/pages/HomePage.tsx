import { useState, useEffect } from "react";
import CreateQuestionForm from "../components/CreateQuestionForm";
import CreateQuizForm from "../components/CreateQuizForm";
import EditQuizForm from "../components/EditQuizForm";
import QuestionList from "../components/QuestionList";
import QuizPlayer from "../components/QuizPlayer";
import { apiGet, apiDelete, ApiError, isDemoMode, resetDemoData } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Quiz = {
  id: number;
  title: string;
  description: string;
};

type Question = {
  id: number;
  text: string;
};

type QuizReadiness = {
  ready: boolean;
  issues: string[];
};

function HomePage() {
  const { logout } = useAuth();
  const demoMode = isDemoMode();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [questionsReloadToken, setQuestionsReloadToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<number | null>(null);
  const [startQuizError, setStartQuizError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const result = await apiGet<Quiz[]>("/api/quizzes");
        setQuizzes(result);
      } catch (error) {
        console.error("Failed to fetch:", error);
        setLoadError("Couldn't load your quizzes. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const activeQuiz = selectedQuiz ?? editingQuiz;
  const otherQuizzes = quizzes.filter((quiz) => quiz.id !== activeQuiz?.id);

  useEffect(() => {
    if (!activeQuiz) {
      return;
    }

    const quizId = activeQuiz.id;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchQuestions() {
      setQuestionsLoading(true);
      setQuestionsError(null);
      // Never show the previously active quiz's questions while the next
      // quiz's questions are still loading.
      setQuestions([]);

      try {
        const result = await apiGet<Question[]>(
          `/api/quizzes/${quizId}/questions`,
          controller.signal,
        );
        if (!cancelled) {
          setQuestions(result);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("Failed to fetch questions:", error);
        setQuestionsError("Couldn't load questions for this quiz.");
      } finally {
        if (!cancelled) {
          setQuestionsLoading(false);
        }
      }
    }

    fetchQuestions();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuiz?.id, questionsReloadToken]);

  const deleteQuiz = async (quiz: Quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiDelete(`/api/quizzes/${quiz.id}`);
      setQuizzes((current) => current.filter((q) => q.id !== quiz.id));
      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(null);
      }
      if (editingQuiz?.id === quiz.id) {
        setEditingQuiz(null);
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error);
    }
  };

  const startQuiz = async (quiz: Quiz) => {
    setStartQuizError(null);
    setStartingQuizId(quiz.id);

    try {
      const readiness = await apiGet<QuizReadiness>(`/api/quizzes/${quiz.id}/readiness`);
      if (!readiness.ready) {
        setStartQuizError(
          `"${quiz.title}" isn't ready to play yet: ${readiness.issues.join(" ")}`,
        );
        return;
      }
      setSelectedQuiz(quiz);
      setEditingQuiz(null);
    } catch (error) {
      console.error("Failed to check quiz readiness:", error);
      const message =
        error instanceof ApiError ? error.message : "Couldn't check this quiz. Please try again.";
      setStartQuizError(message);
    } finally {
      setStartingQuizId(null);
    }
  };

  if (isLoading) {
    return <p className="m-8 p-[18px]">Loading quizzes...</p>;
  }

  const handleHeaderAction = () => {
    if (demoMode) {
      resetDemoData();
      window.location.reload();
      return;
    }

    logout();
  };

  return (
    <div className="min-h-screen w-full bg-primary px-5 py-8">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="mb-6 flex flex-col items-start gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0 text-4xl font-bold sm:text-[40px]">Quiz App</h1>
            <p className="mt-2 mb-0 text-surface">
              {demoMode
                ? "Explore the app with example data, no account or backend setup needed"
                : "Build, manage and test yourself"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
              Create new quiz
            </button>
            <button className="btn-secondary" onClick={handleHeaderAction}>
              {demoMode ? "Reset demo" : "Log out"}
            </button>
          </div>
        </header>

        {loadError && (
          <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-red-600">{loadError}</p>
          </div>
        )}

        {demoMode && (
          <section className="card mb-6">
            <span className="eyebrow">Recruiter demo</span>
            <h2 className="mt-1 mb-2 text-ink">
              Try the full quiz workflow with disposable sample data.
            </h2>
            <p className="m-0 leading-[1.45] text-muted">
              Start a quiz to see the player and score screen, manage questions
              to inspect the authoring tools, or create your own quiz. Changes
              stay in this browser session and can be reset anytime.
            </p>
          </section>
        )}

        {showCreateForm && (
          <CreateQuizForm
            onCancel={() => setShowCreateForm(false)}
            onQuizCreated={(newQuiz) => {
              setQuizzes([...quizzes, newQuiz]);
              setShowCreateForm(false);
            }}
          />
        )}

        <section className="mt-6">
          <h2 className="mt-0 mb-4 text-white">
            {activeQuiz ? "Other quizzes" : "Available Quizzes"}
          </h2>

          {startQuizError && (
            <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-red-600">{startQuizError}</p>
              <button className="btn-secondary" onClick={() => setStartQuizError(null)}>
                Dismiss
              </button>
            </div>
          )}

          {selectedQuiz && (
            <div className="card-active mb-6 flex flex-col items-stretch gap-4">
              <div>
                <span className="eyebrow">Selected quiz</span>
                <h2 className="mt-1 mb-2 text-ink">{selectedQuiz.title}</h2>
                <p className="m-0 leading-[1.45] text-muted">
                  {selectedQuiz.description}
                </p>
                {questionsLoading ? (
                  <p className="text-muted">Loading questions...</p>
                ) : questionsError ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="m-0 text-red-600">{questionsError}</p>
                    <button
                      className="btn-secondary"
                      onClick={() => setQuestionsReloadToken((token) => token + 1)}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <QuizPlayer key={selectedQuiz.id} quiz={selectedQuiz} questions={questions} />
                )}
              </div>
              <button
                className="btn-secondary self-start"
                onClick={() => setSelectedQuiz(null)}
              >
                Back
              </button>
            </div>
          )}

          {editingQuiz && (
            <div className="card-active mb-6 flex flex-col items-stretch gap-4">
              <div>
                <span className="eyebrow">Editing quiz</span>
                <EditQuizForm
                  quiz={editingQuiz}
                  onQuizUpdated={(updatedQuiz) => {
                    setEditingQuiz(updatedQuiz);
                    setQuizzes((current) =>
                      current.map((q) =>
                        q.id === updatedQuiz.id ? updatedQuiz : q,
                      ),
                    );
                  }}
                />
              </div>
              <button
                className="btn-secondary self-start"
                onClick={() => setEditingQuiz(null)}
              >
                Back
              </button>
              {questionsLoading ? (
                <p className="text-muted">Loading questions...</p>
              ) : questionsError ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="m-0 text-red-600">{questionsError}</p>
                  <button
                    className="btn-secondary"
                    onClick={() => setQuestionsReloadToken((token) => token + 1)}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <QuestionList
                  quizId={editingQuiz.id}
                  questions={questions}
                  onQuestionUpdated={(updatedQuestion) =>
                    setQuestions((current) =>
                      current.map((q) =>
                        q.id === updatedQuestion.id ? updatedQuestion : q,
                      ),
                    )
                  }
                  onQuestionDeleted={(deletedId) =>
                    setQuestions((current) =>
                      current.filter((q) => q.id !== deletedId),
                    )
                  }
                  onQuestionsReordered={(reordered) =>
                    setQuestions(reordered)
                  }
                />
              )}
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
            <div className="card">No quizzes available</div>
          ) : otherQuizzes.length > 0 ? (
            <div className="flex flex-wrap gap-5">
              {otherQuizzes.map((quiz) => (
                <article
                  className="card flex w-[280px] min-h-[200px] flex-col"
                  key={quiz.id}
                >
                  <h3 className="m-0 mb-2 text-xl">{quiz.title}</h3>
                  <p className="m-0 mb-4 flex-1 leading-[1.45] text-muted">
                    {quiz.description}
                  </p>

                  <div className="button-row">
                    <button
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={startingQuizId === quiz.id}
                      onClick={() => startQuiz(quiz)}
                    >
                      {startingQuizId === quiz.id ? "Checking..." : "Start Quiz"}
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedQuiz(null);
                        setEditingQuiz(quiz);
                      }}
                    >
                      Edit Quiz
                    </button>
                    <button className="btn-secondary" onClick={() => deleteQuiz(quiz)}>
                      Delete Quiz
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
export default HomePage;
