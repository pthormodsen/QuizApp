import { useRef, useState } from "react";
import type { Term } from "../../api/types";
import { ProgressBar } from "./FlashcardMode";
import StudyEmptyState from "./StudyEmptyState";
import StudyResult, { type MissedItem } from "./StudyResult";
import { buildMultipleChoiceQuestions, useStudyShortcuts, type Random } from "./studyUtils";

type MultipleChoiceModeProps = {
  terms: Term[];
  onExit: () => void;
  random?: Random;
};

function MultipleChoiceMode({ terms, onExit, random = Math.random }: MultipleChoiceModeProps) {
  const [questions, setQuestions] = useState(() => buildMultipleChoiceQuestions(terms, random));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [finished, setFinished] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const question = questions[index];
  const answered = selected !== null;

  const answer = (choice: number) => {
    // Each question can only be answered once.
    if (answered || finished || !question) {
      return;
    }
    setSelected(choice);
    if (choice === question.correctIndex) {
      setCorrectCount((count) => count + 1);
    } else {
      setMissed((current) => [
        ...current,
        {
          termId: question.termId,
          prompt: question.prompt,
          answer: question.answer,
          given: question.choices[choice],
        },
      ]);
    }
    // The choices become disabled, so move focus to the way forward.
    requestAnimationFrame(() => nextRef.current?.focus());
  };

  const next = () => {
    if (index === questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    requestAnimationFrame(() => promptRef.current?.focus());
  };

  const restart = () => {
    setQuestions(buildMultipleChoiceQuestions(terms, random));
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setMissed([]);
    setFinished(false);
    requestAnimationFrame(() => promptRef.current?.focus());
  };

  useStudyShortcuts(rootRef, (event) => {
    const number = Number(event.key);
    if (question && !answered && Number.isInteger(number) && number >= 1 && number <= question.choices.length) {
      event.preventDefault();
      answer(number - 1);
    }
  });

  if (questions.length === 0) {
    return (
      <StudyEmptyState onExit={onExit}>
        Multiple choice needs at least two terms with different definitions.
      </StudyEmptyState>
    );
  }

  if (finished) {
    return (
      <StudyResult
        correct={correctCount}
        total={questions.length}
        missed={missed}
        onRestart={restart}
        onExit={onExit}
      />
    );
  }

  const wasCorrect = selected === question.correctIndex;

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-muted">
        <p className="m-0">
          Question {index + 1} of {questions.length}
        </p>
        <p className="m-0">Score: {correctCount}</p>
      </div>
      <ProgressBar value={index + (answered ? 1 : 0)} max={questions.length} />

      <div className="card flex flex-col gap-5 sm:p-8">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Term</span>
          <h3
            ref={promptRef}
            className="m-0 text-2xl font-semibold whitespace-pre-line text-ink sm:text-3xl"
            tabIndex={-1}
          >
            {question.prompt}
          </h3>
        </div>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="label mb-2.5">Choose the matching definition</legend>
          {question.choices.map((choice, choiceIndex) => {
            const isCorrect = choiceIndex === question.correctIndex;
            const isSelected = choiceIndex === selected;
            const state = !answered
              ? "idle"
              : isCorrect
                ? "correct"
                : isSelected
                  ? "wrong"
                  : "dimmed";
            return (
              <button
                key={choiceIndex}
                type="button"
                className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${
                  state === "correct"
                    ? "border-success bg-green-50"
                    : state === "wrong"
                      ? "border-danger bg-red-50"
                      : state === "dimmed"
                        ? "border-border bg-white opacity-60"
                        : "cursor-pointer border-border bg-white hover:border-primary hover:bg-surface"
                }`}
                disabled={answered}
                onClick={() => answer(choiceIndex)}
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary-strong"
                  aria-hidden="true"
                >
                  {choiceIndex + 1}
                </span>
                <span className="flex-1 whitespace-pre-line text-ink">{choice}</span>
                {state === "correct" && (
                  <span className="text-sm font-semibold text-success">Correct answer</span>
                )}
                {state === "wrong" && (
                  <span className="text-sm font-semibold text-danger">Your answer</span>
                )}
              </button>
            );
          })}
        </fieldset>

        <div role="status" className="min-h-0">
          {answered && (
            <p className={`m-0 font-semibold ${wasCorrect ? "text-success" : "text-danger"}`}>
              {wasCorrect ? "Correct!" : `Not quite. The answer is: ${question.answer}`}
            </p>
          )}
        </div>

        {answered && (
          <button ref={nextRef} className="btn-primary self-end" type="button" onClick={next}>
            {index === questions.length - 1 ? "See results" : "Next question"}
          </button>
        )}
      </div>
      {!answered && (
        <p className="m-0 hidden text-center text-xs text-muted sm:block">
          Press 1–{question.choices.length} to answer
        </p>
      )}
    </div>
  );
}

export default MultipleChoiceMode;
