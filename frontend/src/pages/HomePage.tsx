import { useState, useEffect } from "react";
import CreateQuestionForm from "../components/CreateQuestionForm";
import CreateQuizForm from "../components/CreateQuizForm";
import QuestionList from "../components/QuestionList";
import QuizPlayer from "../components/QuizPlayer";
import { apiGet } from "../api/client";
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

function HomePage() {
  const { logout } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await apiGet<Quiz[]>("/api/quizzes");
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
        const result = await apiGet<Question[]>(
          `/api/quizzes/${quizId}/questions`,
        );
        setQuestions(result);
      } catch (error) {
        console.error("Failed to fetch questions:", error);
      }
    }

    fetchQuestions();
  }, [editingQuiz, selectedQuiz]);

  if (isLoading) {
    return <p className="m-8 p-[18px]">Loading quizzes...</p>;
  }

  return (
    <div className="min-h-screen w-full bg-[#5d6fe4] px-5 py-8">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="mb-6 flex flex-col items-start gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0 text-4xl font-bold sm:text-[40px]">Quiz App</h1>
            <p className="mt-2 mb-0 text-[#eef1ff]">
              Build, manage and test yourself
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
              onClick={() => setShowCreateForm(true)}
            >
              Create new quiz
            </button>
            <button
              className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
              onClick={logout}
            >
              Log out
            </button>
          </div>
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

        <section className="mt-6">
          <h2 className="mt-0 mb-4 text-white">Available Quizzes</h2>

          {selectedQuiz && (
            <div className="mb-[18px] flex flex-col items-stretch gap-4 rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]">
              <div>
                <span className="text-[13px] font-bold text-[#5d6fe4] uppercase">
                  Selected quiz
                </span>
                <h2 className="mt-1 mb-2 text-[#172033]">{selectedQuiz.title}</h2>
                <p className="m-0 leading-[1.45] text-[#5a6275]">
                  {selectedQuiz.description}
                </p>
                <QuizPlayer quiz={selectedQuiz} questions={questions} />
              </div>
              <button
                className="cursor-pointer self-start rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
                onClick={() => setSelectedQuiz(null)}
              >
                Back
              </button>
            </div>
          )}

          {editingQuiz && (
            <div className="mb-[18px] flex flex-col items-stretch gap-4 rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]">
              <div>
                <span className="text-[13px] font-bold text-[#5d6fe4] uppercase">
                  Editing quiz
                </span>
                <h2 className="mt-1 mb-2 text-[#172033]">{editingQuiz.title}</h2>
                <p className="m-0 leading-[1.45] text-[#5a6275]">
                  {editingQuiz.description}
                </p>
              </div>
              <button
                className="cursor-pointer self-start rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
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
            <div className="rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]">
              No quizzes available
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {quizzes.map((quiz) => (
                <article
                  className="flex w-[260px] min-h-[180px] flex-col rounded-lg border border-[#dfe3f0] bg-white p-[18px] shadow-[0_10px_24px_rgba(22,28,45,0.14)]"
                  key={quiz.id}
                >
                  <h3 className="m-0 mb-2 text-xl">{quiz.title}</h3>
                  <p className="m-0 mb-[18px] flex-1 leading-[1.45] text-[#5a6275]">
                    {quiz.description}
                  </p>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      className="cursor-pointer rounded-md bg-[#172033] px-3.5 py-2.5 font-bold text-white"
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setEditingQuiz(null);
                      }}
                    >
                      Start Quiz
                    </button>

                    <button
                      className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]"
                      onClick={() => {
                        setSelectedQuiz(null);
                        setEditingQuiz(quiz);
                      }}
                    >
                      Edit Quiz
                    </button>
                    <button className="cursor-pointer rounded-md bg-[#eef1ff] px-3.5 py-2.5 font-bold text-[#172033]">
                      Delete Quiz
                    </button>
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
