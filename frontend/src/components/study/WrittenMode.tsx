import { useEffect, useId, useRef, useState } from "react";
import type { Term } from "../../api/types";
import { ProgressBar } from "./FlashcardMode";
import StudyEmptyState from "./StudyEmptyState";
import StudyResult, { type MissedItem } from "./StudyResult";
import { isCorrectAnswer, shuffle, type Random } from "./studyUtils";

type WrittenModeProps = {
  terms: Term[];
  onExit: () => void;
  random?: Random;
};

type Result = { correct: boolean; given: string };

function WrittenMode({ terms, onExit, random = Math.random }: WrittenModeProps) {
  const [order, setOrder] = useState(() => shuffle(terms, random));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();

  const term = order[index];

  // Start typing right away, unless the user has already moved focus somewhere specific.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active.hasAttribute("data-study-heading")) {
      inputRef.current?.focus();
    }
  }, []);

  const grade = (given: string) => {
    // Each term is graded once; the input is read-only afterwards.
    if (result || !term) {
      return;
    }
    const correct = given.trim() !== "" && isCorrectAnswer(given, term.definition);
    setResult({ correct, given });
    setInputError(null);
    if (correct) {
      setCorrectCount((count) => count + 1);
    } else {
      setMissed((current) => [
        ...current,
        { termId: term.id, prompt: term.term, answer: term.definition, given },
      ]);
    }
    requestAnimationFrame(() => nextRef.current?.focus());
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (result) {
      next();
      return;
    }
    if (answer.trim() === "") {
      setInputError("Type an answer, or choose “Don't know”.");
      return;
    }
    grade(answer);
  };

  const next = () => {
    if (index === order.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setAnswer("");
    setResult(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const restart = () => {
    setOrder(shuffle(terms, random));
    setIndex(0);
    setAnswer("");
    setResult(null);
    setInputError(null);
    setCorrectCount(0);
    setMissed([]);
    setFinished(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (terms.length === 0) {
    return (
      <StudyEmptyState onExit={onExit}>Add a term to this set to practise writing definitions.</StudyEmptyState>
    );
  }

  if (finished) {
    return (
      <StudyResult
        correct={correctCount}
        total={order.length}
        missed={missed}
        onRestart={restart}
        onExit={onExit}
      />
    );
  }

  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-muted">
        <p className="m-0">
          Term {index + 1} of {order.length}
        </p>
        <p className="m-0">Score: {correctCount}</p>
      </div>
      <ProgressBar value={index + (result ? 1 : 0)} max={order.length} />

      <form className="card flex flex-col gap-5 sm:p-8" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Term</span>
          <h3 className="m-0 text-2xl font-semibold whitespace-pre-line text-ink sm:text-3xl">
            {term.term}
          </h3>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label" htmlFor={inputId}>
            Your answer
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className={`field w-full ${
              result ? (result.correct ? "border-success" : "border-danger") : ""
            }`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Type the definition"
            value={answer}
            readOnly={result !== null}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? errorId : undefined}
            onChange={(e) => {
              setAnswer(e.target.value);
              setInputError(null);
            }}
          />
          {inputError && (
            <p id={errorId} className="field-error">
              {inputError}
            </p>
          )}
        </div>

        <div role="status">
          {result && (
            <div
              className={`flex flex-col gap-1 rounded-lg border px-4 py-3 ${
                result.correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              }`}
            >
              <p className={`m-0 font-semibold ${result.correct ? "text-success" : "text-danger"}`}>
                {result.correct ? "Correct!" : result.given.trim() === "" ? "Not answered." : "Not quite."}
              </p>
              <p className="m-0 text-sm text-ink">
                <span className="font-semibold">Expected answer: </span>
                <span className="whitespace-pre-line">{term.definition}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          {result ? (
            <button ref={nextRef} className="btn-primary" type="submit">
              {index === order.length - 1 ? "See results" : "Next term"}
            </button>
          ) : (
            <>
              <button className="btn-ghost" type="button" onClick={() => grade("")}>
                Don't know
              </button>
              <button className="btn-primary" type="submit">
                Check answer
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default WrittenMode;
