import type { ReactNode } from "react";
import { STUDY_MODES, type StudyMode } from "./studyUtils";

const ICONS: Record<StudyMode, ReactNode> = {
  flashcards: (
    <>
      <rect x="3" y="6" width="14" height="13" rx="2" />
      <path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-2" />
    </>
  ),
  "multiple-choice": (
    <>
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <path d="M11 7h9M11 17h9" />
    </>
  ),
  written: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
};

type StudyModeSelectorProps = {
  termCount: number;
  onSelect: (mode: StudyMode) => void;
};

/** The three ways to study a set, shown at the top of the set page. */
function StudyModeSelector({ termCount, onSelect }: StudyModeSelectorProps) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
      {STUDY_MODES.map(({ mode, label, description, minTerms }) => {
        const unavailable = termCount < minTerms;
        const descriptionId = `study-mode-${mode}-description`;
        return (
          <li key={mode}>
            <button
              type="button"
              data-study-mode={mode}
              className="group flex h-full w-full cursor-pointer flex-col items-start gap-2 rounded-xl border border-border bg-white p-4 text-left shadow-card-sm transition hover:enabled:-translate-y-0.5 hover:enabled:border-primary hover:enabled:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
              aria-describedby={descriptionId}
              disabled={unavailable}
              onClick={() => onSelect(mode)}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-surface text-primary-strong transition-colors group-hover:group-enabled:bg-primary-strong group-hover:group-enabled:text-white">
                <svg
                  aria-hidden="true"
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[mode]}
                </svg>
              </span>
              <span className="font-semibold text-ink">{label}</span>
              <span id={descriptionId} className="text-sm text-muted">
                {unavailable
                  ? `Add at least ${minTerms} ${minTerms === 1 ? "term" : "terms"} to use this mode.`
                  : description}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default StudyModeSelector;
