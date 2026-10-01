import { useEffect, useId, useState } from "react";
import type { Ref } from "react";
import { apiGet } from "../../api/client";
import type { StudySet, Term } from "../../api/types";
import Alert from "../Alert";
import Skeleton from "../Skeleton";
import FlashcardMode from "./FlashcardMode";
import MultipleChoiceMode from "./MultipleChoiceMode";
import WrittenMode from "./WrittenMode";
import { STUDY_MODES, studyModeInfo, type StudyMode } from "./studyUtils";

type StudySessionProps = {
  studySet: StudySet;
  mode: StudyMode;
  onChangeMode: (mode: StudyMode) => void;
  onExit: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
};

/** Loads the set's terms and runs one study mode. Progress lives only in this component. */
function StudySession({ studySet, mode, onChangeMode, onExit, headingRef }: StudySessionProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const headingId = useId();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTerms() {
      setTerms(null);
      setLoadError(null);
      try {
        setTerms(await apiGet<Term[]>(`/api/study-sets/${studySet.id}/terms`, controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch terms:", error);
        setLoadError("Couldn't load the terms in this set.");
      }
    }

    fetchTerms();
    return () => controller.abort();
  }, [studySet.id, reloadToken]);

  const ModeComponent =
    mode === "flashcards" ? FlashcardMode : mode === "multiple-choice" ? MultipleChoiceMode : WrittenMode;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow m-0">{studyModeInfo(mode).label}</p>
          <h2
            id={headingId}
            ref={headingRef}
            className="page-title break-words"
            tabIndex={-1}
            data-study-heading
          >
            {studySet.title}
          </h2>
        </div>
        <button className="btn-secondary" type="button" onClick={onExit}>
          Back to set
        </button>
      </div>

      <nav aria-label="Study mode">
        <ul className="m-0 inline-flex list-none gap-1 rounded-xl border border-border bg-white p-1">
          {STUDY_MODES.map((info) => (
            <li key={info.mode}>
              <button
                type="button"
                className={`min-h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors ${
                  info.mode === mode
                    ? "bg-primary-strong text-white"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
                aria-current={info.mode === mode ? "page" : undefined}
                onClick={() => info.mode !== mode && onChangeMode(info.mode)}
              >
                {info.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {loadError ? (
        <Alert message={loadError} onRetry={() => setReloadToken((token) => token + 1)} />
      ) : terms === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading terms">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-72 sm:h-80" />
        </div>
      ) : (
        // Keyed by mode so switching modes starts a fresh round.
        <ModeComponent key={mode} terms={terms} onExit={onExit} />
      )}
    </section>
  );
}

export default StudySession;
