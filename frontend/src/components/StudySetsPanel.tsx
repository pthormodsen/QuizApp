import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiDelete, apiGet, ApiError } from "../api/client";
import type { StudySet } from "../api/types";
import Alert from "./Alert";
import { SkeletonCard } from "./Skeleton";
import StudySetCard from "./StudySetCard";
import StudySetForm from "./StudySetForm";
import TermEditor from "./TermEditor";

function StudySetsPanel() {
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const createHeadingRef = useRef<HTMLHeadingElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);

  // The URL is the single source of truth for which view is open:
  // no "set" param = list, "?set=new" = create form, "?set=<id>" = editor.
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = searchParams.get("set");
  const showCreateForm = setParam === "new";
  const editingParam = setParam !== null && !showCreateForm ? setParam : null;

  // Other params (e.g. ?demo=true) are kept. Opening a view pushes a history
  // entry so browser Back/Forward move between the list and the editors.
  const showView = (value: string | null, options?: { replace?: boolean }) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) {
        next.delete("set");
      } else {
        next.set("set", value);
      }
      return next;
    }, options);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStudySets() {
      try {
        setIsLoading(true);
        setLoadError(null);
        setStudySets(await apiGet<StudySet[]>("/api/study-sets", controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch study sets:", error);
        setLoadError("Couldn't load your study sets. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchStudySets();
    return () => controller.abort();
  }, [reloadToken]);

  const editingSet =
    editingParam === null ? null : (studySets.find((s) => String(s.id) === editingParam) ?? null);

  // Move focus when the URL switches views (in-app or via Back/Forward), but not on
  // the initial render, e.g. after a refresh or when returning from the Quizzes tab.
  const previousSetParam = useRef(setParam);
  useEffect(() => {
    const previous = previousSetParam.current;
    if (isLoading || previous === setParam) {
      return;
    }
    previousSetParam.current = setParam;

    if (setParam === "new") {
      createHeadingRef.current?.focus();
    } else if (setParam !== null) {
      editorHeadingRef.current?.focus();
    } else {
      // Back on the list: return to the card that opened the editor when it still exists.
      const cards = listRef.current?.querySelectorAll<HTMLElement>("[data-study-set-id]") ?? [];
      const openedCard = Array.from(cards).find((card) => card.dataset.studySetId === previous);
      (openedCard?.querySelector("button") ?? listHeadingRef.current)?.focus();
    }
  }, [setParam, isLoading]);

  const replaceSet = (updated: StudySet) =>
    setStudySets((current) => current.map((s) => (s.id === updated.id ? updated : s)));

  const deleteSet = async (studySet: StudySet) => {
    if (!window.confirm(`Delete "${studySet.title}" and all its terms? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    try {
      await apiDelete(`/api/study-sets/${studySet.id}`);
      setStudySets((current) => current.filter((s) => s.id !== studySet.id));
      // The deleted card held focus; move it somewhere stable instead of <body>.
      listHeadingRef.current?.focus();
    } catch (error) {
      console.error("Failed to delete study set:", error);
      setActionError(
        error instanceof ApiError ? error.message : "Couldn't delete the study set. Please try again.",
      );
    }
  };

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6" aria-busy="true" aria-label="Loading study sets">
        <h2 className="page-title">Your study sets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    );
  }

  if (editingParam !== null && !editingSet && !loadError) {
    return (
      <div className="card flex flex-col items-start gap-3">
        <h2 ref={editorHeadingRef} className="section-title" tabIndex={-1}>
          Study set not found
        </h2>
        <p className="m-0 text-muted">
          This study set doesn't exist, has been deleted, or you don't have access to it.
        </p>
        <button className="btn-secondary" onClick={() => showView(null)}>
          Back to study sets
        </button>
      </div>
    );
  }

  if (editingSet) {
    return (
      <div className="card-active flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 ref={editorHeadingRef} className="eyebrow" tabIndex={-1}>
            Editing study set
          </h2>
          <button className="btn-secondary" onClick={() => showView(null)}>
            Back to study sets
          </button>
        </div>
        <StudySetForm
          key={editingSet.id}
          studySet={editingSet}
          onSaved={(updated) => replaceSet(updated)}
        />
        <TermEditor
          studySetId={editingSet.id}
          onTermCountChanged={(termCount) =>
            setStudySets((current) =>
              current.map((s) => (s.id === editingSet.id ? { ...s, termCount } : s)),
            )
          }
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 ref={listHeadingRef} className="page-title" tabIndex={-1}>
            Your study sets
          </h2>
          {!loadError && (
            <p className="mt-1 mb-0 text-sm text-muted">
              {studySets.length === 1 ? "1 set" : `${studySets.length} sets`}
            </p>
          )}
        </div>
        {!showCreateForm && (loadError || studySets.length > 0) && (
          <button className="btn-primary" onClick={() => showView("new")}>
            New study set
          </button>
        )}
      </div>

      {loadError && (
        <Alert message={loadError} onRetry={() => setReloadToken((token) => token + 1)} />
      )}
      {actionError && <Alert message={actionError} onDismiss={() => setActionError(null)} />}

      {showCreateForm && (
        <div className="card max-w-[520px]">
          <h3 ref={createHeadingRef} className="section-title mb-4" tabIndex={-1}>
            Create study set
          </h3>
          <StudySetForm
            onCancel={() => showView(null)}
            onSaved={(created) => {
              setStudySets((current) => [created, ...current]);
              // Replace "?set=new" so Back from the new set's editor returns to the list.
              showView(String(created.id), { replace: true });
            }}
          />
        </div>
      )}

      {loadError ? null : studySets.length === 0 ? (
        !showCreateForm && (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <h3 className="section-title">Create your first study set</h3>
            <p className="m-0 max-w-sm text-muted">
              A study set is a list of terms and their definitions you can practise with.
            </p>
            <button className="btn-primary" onClick={() => showView("new")}>
              New study set
            </button>
          </div>
        )
      ) : (
        <div ref={listRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studySets.map((studySet) => (
            <StudySetCard
              key={studySet.id}
              studySet={studySet}
              onOpen={() => showView(String(studySet.id))}
              onDelete={() => deleteSet(studySet)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default StudySetsPanel;
