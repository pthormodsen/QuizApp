import { useEffect, useRef } from "react";

export type MissedItem = { termId: number; prompt: string; answer: string; given: string | null };

type StudyResultProps = {
  correct: number;
  total: number;
  missed: MissedItem[];
  onRestart: () => void;
  onExit: () => void;
};

function encouragement(ratio: number): string {
  if (ratio === 1) return "Perfect score. You know this set.";
  if (ratio >= 0.8) return "Great work. Just a few to review.";
  if (ratio >= 0.5) return "Good progress. Review the ones you missed and go again.";
  return "Keep going. Each round makes these stick a little better.";
}

/** Final score for a multiple choice or written round, with the terms to review. */
function StudyResult({ correct, total, missed, onRestart, onExit }: StudyResultProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="card flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="eyebrow">Round complete</span>
        <h3 ref={headingRef} className="m-0 text-3xl font-bold text-ink" tabIndex={-1}>
          {correct} of {total} correct
        </h3>
        <p className="m-0 text-lg font-semibold text-primary-strong">{percent}%</p>
        <p className="m-0 max-w-sm text-muted">{encouragement(total === 0 ? 0 : correct / total)}</p>
      </div>
      {missed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="label m-0">To review ({missed.length})</h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {missed.map((item) => (
              <li key={item.termId} className="rounded-lg border border-border bg-canvas p-3 text-sm">
                <p className="m-0 font-semibold text-ink">{item.prompt}</p>
                <p className="m-0 text-ink">{item.answer}</p>
                {item.given !== null && (
                  <p className="m-0 text-muted">
                    You answered: <span className="text-danger">{item.given || "(no answer)"}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap justify-center gap-2.5">
        <button className="btn-primary" type="button" onClick={onRestart}>
          Restart
        </button>
        <button className="btn-secondary" type="button" onClick={onExit}>
          Back to set
        </button>
      </div>
    </div>
  );
}

export default StudyResult;
