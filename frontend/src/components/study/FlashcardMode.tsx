import { useEffect, useRef, useState } from "react";
import type { Term } from "../../api/types";
import StudyEmptyState from "./StudyEmptyState";
import { shuffle, useStudyShortcuts, type Random } from "./studyUtils";

type FlashcardModeProps = {
  terms: Term[];
  onExit: () => void;
  random?: Random;
};

function FlashcardMode({ terms, onExit, random = Math.random }: FlashcardModeProps) {
  const [cards, setCards] = useState(terms);
  const [isShuffled, setIsShuffled] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const finishHeadingRef = useRef<HTMLHeadingElement>(null);

  // Finishing removes the focused card controls; move focus to the summary.
  useEffect(() => {
    if (finished) {
      finishHeadingRef.current?.focus();
    }
  }, [finished]);

  const isLast = index === cards.length - 1;

  const goTo = (next: number) => {
    setIndex(next);
    setRevealed(false);
  };
  const previous = () => index > 0 && goTo(index - 1);
  const next = () => (isLast ? setFinished(true) : goTo(index + 1));

  const restart = (shuffled: boolean) => {
    setCards(shuffled ? shuffle(terms, random) : terms);
    setIsShuffled(shuffled);
    setIndex(0);
    setRevealed(false);
    setFinished(false);
    // The card is rendered again after the completion screen; focus it once it exists.
    requestAnimationFrame(() => cardRef.current?.focus());
  };

  useStudyShortcuts(rootRef, (event) => {
    if (finished) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === " " && !(event.target as HTMLElement | null)?.closest("button")) {
      event.preventDefault();
      setRevealed((current) => !current);
    }
  });

  if (terms.length === 0) {
    return (
      <StudyEmptyState onExit={onExit}>Add a term to this set to study it with flashcards.</StudyEmptyState>
    );
  }

  if (finished) {
    return (
      <div ref={rootRef} className="card flex flex-col items-center gap-4 py-10 text-center">
        <h3 ref={finishHeadingRef} className="section-title" tabIndex={-1}>
          You went through all {cards.length} cards
        </h3>
        <p className="m-0 max-w-sm text-muted">
          Go again to strengthen what you remember, or switch to another mode to test yourself.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button className="btn-primary" type="button" onClick={() => restart(isShuffled)}>
            Restart
          </button>
          <button className="btn-secondary" type="button" onClick={() => restart(true)}>
            Shuffle and restart
          </button>
        </div>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold text-muted" aria-live="polite">
          Card {index + 1} / {cards.length}
        </p>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-sm"
            type="button"
            aria-pressed={isShuffled}
            onClick={() => restart(!isShuffled)}
          >
            {isShuffled ? "Shuffled" : "Shuffle"}
          </button>
          <button className="btn-ghost text-sm" type="button" onClick={() => restart(isShuffled)}>
            Restart
          </button>
        </div>
      </div>
      <ProgressBar value={index + 1} max={cards.length} />

      <div className="perspective-distant">
        <button
          ref={cardRef}
          type="button"
          className={`relative block h-72 w-full cursor-pointer rounded-2xl text-left transform-3d motion-safe:transition-transform motion-safe:duration-500 sm:h-80 ${
            revealed ? "rotate-y-180" : ""
          }`}
          aria-label={revealed ? `Definition: ${card.definition}. Show term` : `Term: ${card.term}. Show definition`}
          onClick={() => setRevealed((current) => !current)}
        >
          <CardFace side="Term" text={card.term} hidden={revealed} />
          <CardFace side="Definition" text={card.definition} hidden={!revealed} back />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button className="btn-secondary" type="button" disabled={index === 0} onClick={previous}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <p className="m-0 hidden text-xs text-muted sm:block">
          Space to flip · ← → to move
        </p>
        <button className="btn-primary" type="button" onClick={next}>
          {isLast ? "Finish" : "Next"} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

function CardFace({
  side,
  text,
  hidden,
  back = false,
}: {
  side: string;
  text: string;
  hidden: boolean;
  back?: boolean;
}) {
  return (
    <span
      aria-hidden={hidden}
      className={`absolute inset-0 flex flex-col gap-3 overflow-y-auto rounded-2xl border p-6 backface-hidden sm:p-8 ${
        back
          ? "rotate-y-180 border-primary/30 bg-surface"
          : "border-border bg-white shadow-card"
      }`}
    >
      <span className="eyebrow">{side}</span>
      <span className="m-auto text-center text-2xl font-semibold whitespace-pre-line text-ink sm:text-3xl">
        {text}
      </span>
      <span className="text-center text-xs text-muted">Tap to flip</span>
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
      <div
        className="h-full rounded-full bg-primary-strong motion-safe:transition-[width]"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}

export default FlashcardMode;
