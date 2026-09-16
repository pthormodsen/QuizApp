import { useEffect, useState } from "react";
import AnswerOptionForm, { type AnswerOption } from "./AnswerOptionForm";
import { apiGet, apiPatch, apiDelete, ApiError } from "../api/client";

type Question = {
  id: number;
  text: string;
};

function AnswerOptionRow({
  questionId,
  answerOption,
  onChanged,
}: {
  questionId: number;
  answerOption: AnswerOption;
  onChanged: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(answerOption.text);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const markCorrect = async () => {
    if (answerOption.correct || isSubmitting) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiPatch<AnswerOption>(
        `/api/questions/${questionId}/answers/${answerOption.id}`,
        { correct: true },
      );
      onChanged();
    } catch (err) {
      console.error("Error updating answer option:", err);
      setError(err instanceof ApiError ? err.message : "Failed to update answer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveText = async () => {
    setError(null);
    if (text.trim() === "") {
      setError("Answer text is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiPatch<AnswerOption>(
        `/api/questions/${questionId}/answers/${answerOption.id}`,
        { text },
      );
      onChanged();
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating answer option:", err);
      setError(err instanceof ApiError ? err.message : "Failed to save answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAnswerOption = async () => {
    if (!window.confirm(`Delete answer "${answerOption.text}"?`)) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiDelete(`/api/questions/${questionId}/answers/${answerOption.id}`);
      onChanged();
    } catch (err) {
      console.error("Error deleting answer option:", err);
      setError(err instanceof ApiError ? err.message : "Failed to delete answer. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isEditing) {
    return (
      <li className="flex flex-col gap-1">
        {error && <p className="m-0 text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            className="field flex-1 px-2.5 py-1.5 text-sm"
            value={text}
            disabled={isSubmitting}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isSubmitting}
            onClick={saveText}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button
            className="btn-secondary"
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setText(answerOption.text);
              setError(null);
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1">
      {error && <p className="m-0 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <label className="flex flex-1 items-center gap-1.5 text-sm">
          <input
            type="radio"
            name={`correct-answer-${questionId}`}
            checked={answerOption.correct}
            disabled={isSubmitting}
            onChange={markCorrect}
          />
          {answerOption.text}
        </label>
        <button
          className="btn-secondary"
          type="button"
          disabled={isSubmitting}
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
        <button
          className="btn-danger"
          type="button"
          disabled={isSubmitting}
          onClick={deleteAnswerOption}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function QuestionItem({
  quizId,
  question,
  isFirst,
  isLast,
  isReordering,
  onQuestionUpdated,
  onQuestionDeleted,
  onMoveUp,
  onMoveDown,
}: {
  quizId: number;
  question: Question;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  onQuestionUpdated: (question: Question) => void;
  onQuestionDeleted: (questionId: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [answerOptions, setAnswerOptions] = useState<AnswerOption[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [text, setText] = useState(question.text);
  const [textError, setTextError] = useState<string | null>(null);
  const [isSavingText, setIsSavingText] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [answersReloadToken, setAnswersReloadToken] = useState(0);
  const reloadAnswerOptions = () => setAnswersReloadToken((token) => token + 1);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    let cancelled = false;

    async function fetchAnswerOptions() {
      setAnswersLoading(true);
      setAnswersError(null);
      try {
        const result = await apiGet<AnswerOption[]>(
          `/api/questions/${question.id}/answers`,
        );
        if (!cancelled) {
          setAnswerOptions(result);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch answer options:", error);
          setAnswersError("Couldn't load answers for this question.");
        }
      } finally {
        if (!cancelled) {
          setAnswersLoading(false);
        }
      }
    }

    fetchAnswerOptions();
    return () => {
      cancelled = true;
    };
  }, [expanded, question.id, answersReloadToken]);

  const saveText = async () => {
    setTextError(null);
    if (text.trim() === "") {
      setTextError("Question text is required");
      return;
    }
    setIsSavingText(true);
    try {
      const updated = await apiPatch<Question>(
        `/api/quizzes/${quizId}/questions/${question.id}`,
        { text },
      );
      onQuestionUpdated(updated);
      setIsEditingText(false);
    } catch (err) {
      console.error("Error updating question:", err);
      setTextError(err instanceof ApiError ? err.message : "Failed to save question. Please try again.");
    } finally {
      setIsSavingText(false);
    }
  };

  const deleteQuestion = async () => {
    if (!window.confirm(`Delete question "${question.text}"? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiDelete(`/api/quizzes/${quizId}/questions/${question.id}`);
      onQuestionDeleted(question.id);
    } catch (err) {
      console.error("Error deleting question:", err);
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete question. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="border-t border-surface py-3">
      <div className="flex items-center justify-between gap-3">
        {isEditingText ? (
          <div className="flex flex-1 flex-col gap-1">
            {textError && <p className="m-0 text-sm text-red-600">{textError}</p>}
            <div className="flex items-center gap-2">
              <input
                className="field flex-1 px-2.5 py-1.5"
                value={text}
                disabled={isSavingText}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              <button
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={isSavingText}
                onClick={saveText}
              >
                {isSavingText ? "Saving..." : "Save"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={isSavingText}
                onClick={() => {
                  setText(question.text);
                  setTextError(null);
                  setIsEditingText(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="m-0 flex-1 font-bold">{question.text}</p>
        )}

        {!isEditingText && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onMoveUp}
              disabled={isFirst || isReordering}
              aria-label="Move question up"
            >
              ↑
            </button>
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onMoveDown}
              disabled={isLast || isReordering}
              aria-label="Move question down"
            >
              ↓
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setIsEditingText(true)}
            >
              Edit
            </button>
            <button
              className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isDeleting}
              onClick={deleteQuestion}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Hide answers" : "Manage answers"}
            </button>
          </div>
        )}
      </div>

      {deleteError && <p className="mt-2 mb-0 text-sm text-red-600">{deleteError}</p>}

      {expanded && (
        <div className="mt-2.5">
          {answersLoading ? (
            <p className="mb-2.5 text-muted">Loading answers...</p>
          ) : answersError ? (
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
              <p className="m-0 text-red-600">{answersError}</p>
              <button className="btn-secondary" type="button" onClick={reloadAnswerOptions}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {answerOptions.length === 0 ? (
                <p className="mb-2.5 text-muted">No answers yet.</p>
              ) : (
                <ul className="m-0 mb-2.5 flex list-none flex-col gap-1 p-0">
                  {answerOptions.map((answerOption) => (
                    <AnswerOptionRow
                      key={answerOption.id}
                      questionId={question.id}
                      answerOption={answerOption}
                      onChanged={reloadAnswerOptions}
                    />
                  ))}
                </ul>
              )}

              <AnswerOptionForm
                questionId={question.id}
                onAnswerOptionCreated={reloadAnswerOptions}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionList({
  quizId,
  questions,
  onQuestionUpdated,
  onQuestionDeleted,
  onQuestionsReordered,
}: {
  quizId: number;
  questions: Question[];
  onQuestionUpdated: (question: Question) => void;
  onQuestionDeleted: (questionId: number) => void;
  onQuestionsReordered: (questions: Question[]) => void;
}) {
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length || isReordering) {
      return;
    }

    const reordered = [...questions];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];

    setReorderError(null);
    setIsReordering(true);
    try {
      const updated = await apiPatch<Question[]>(
        `/api/quizzes/${quizId}/questions/reorder`,
        { questionIds: reordered.map((q) => q.id) },
      );
      onQuestionsReordered(updated);
    } catch (err) {
      console.error("Error reordering questions:", err);
      setReorderError(err instanceof ApiError ? err.message : "Failed to reorder questions. Please try again.");
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div>
      <h2>Questions</h2>
      {reorderError && <p className="text-red-600">{reorderError}</p>}
      {questions.length === 0 ? (
        <p>No questions yet. Add the first one!</p>
      ) : (
        questions.map((question, index) => (
          <QuestionItem
            key={question.id}
            quizId={quizId}
            question={question}
            isFirst={index === 0}
            isLast={index === questions.length - 1}
            isReordering={isReordering}
            onQuestionUpdated={onQuestionUpdated}
            onQuestionDeleted={onQuestionDeleted}
            onMoveUp={() => moveQuestion(index, -1)}
            onMoveDown={() => moveQuestion(index, 1)}
          />
        ))
      )}
    </div>
  );
}

export default QuestionList;
