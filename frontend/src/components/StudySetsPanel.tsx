import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { useSearchParams } from "react-router-dom";
import { apiDelete, apiGet, ApiError } from "../api/client";
import type { StudySet } from "../api/types";
import Alert from "./Alert";
import { SkeletonCard } from "./Skeleton";
import StudySetCard from "./StudySetCard";
import StudySetForm from "./StudySetForm";
import TermEditor from "./TermEditor";
import { combineStatuses, type SaveStatus } from "./formValidation";
import StudyModeSelector from "./study/StudyModeSelector";
import StudySession from "./study/StudySession";
import { parseStudyMode, type StudyMode } from "./study/studyUtils";

type Destination = { set: string | null; study?: StudyMode | null };

export type StudySetsPanelHandle = {
  /**
   * Asks before an action that leaves the open editor (e.g. logging out) would lose unsaved
   * study set details or terms. Returns false if the user wants to stay.
   */
  confirmLeave: (action: string) => boolean;
};

function StudySetsPanel({ ref }: { ref?: Ref<StudySetsPanelHandle> }) {
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const createHeadingRef = useRef<HTMLHeadingElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const sessionHeadingRef = useRef<HTMLHeadingElement>(null);
  const setPageRef = useRef<HTMLDivElement>(null);

  // The URL is the single source of truth for which view is open:
  // no "set" param = list, "?set=new" = create form, "?set=<id>" = the set's page (study
  // modes + editor), "?set=<id>&study=<mode>" = a study session.
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = searchParams.get("set");
  const showCreateForm = setParam === "new";
  const editingParam = setParam !== null && !showCreateForm ? setParam : null;
  const studyMode = editingParam === null ? null : parseStudyMode(searchParams.get("study"));
  const viewKey = `${setParam ?? ""}|${studyMode ?? ""}`;

  // Other params (e.g. ?demo=true) are kept. Opening a view pushes a history
  // entry so browser Back/Forward move between the list, sets and study sessions.
  const navigateTo = (destination: Destination, options?: { replace?: boolean }) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (destination.set === null) {
        next.delete("set");
      } else {
        next.set("set", destination.set);
      }
      if (destination.study) {
        next.set("study", destination.study);
      } else {
        next.delete("study");
      }
      return next;
    }, options);
  const showView = (value: string | null, options?: { replace?: boolean }) =>
    navigateTo({ set: value }, options);

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
  const previousView = useRef({ key: viewKey, setParam, studyMode });
  useEffect(() => {
    const previous = previousView.current;
    if (isLoading || previous.key === viewKey) {
      return;
    }
    previousView.current = { key: viewKey, setParam, studyMode };

    if (setParam === "new") {
      createHeadingRef.current?.focus();
    } else if (setParam !== null && studyMode !== null) {
      sessionHeadingRef.current?.focus();
    } else if (setParam !== null) {
      // Back from a study session: return to the mode that was being studied.
      const modeButton =
        previous.setParam === setParam && previous.studyMode
          ? setPageRef.current?.querySelector<HTMLButtonElement>(
              `[data-study-mode="${previous.studyMode}"]`,
            )
          : null;
      (modeButton ?? editorHeadingRef.current)?.focus();
    } else {
      // Back on the list: return to the card that opened the editor when it still exists.
      const cards = listRef.current?.querySelectorAll<HTMLElement>("[data-study-set-id]") ?? [];
      const openedCard = Array.from(cards).find(
        (card) => card.dataset.studySetId === previous.setParam,
      );
      (openedCard?.querySelector("button") ?? listHeadingRef.current)?.focus();
    }
  }, [viewKey, setParam, studyMode, isLoading]);

  const replaceSet = (updated: StudySet) =>
    setStudySets((current) => current.map((s) => (s.id === updated.id ? updated : s)));

  // Save state of the open set's details and terms, used to guard leaving the editor
  // (to the list, a study session, or by logging out). Clicking a way out blurs the edited
  // field first, so a save is usually still in flight: wait for it and only leave once
  // everything saved, so a failure stays visible in the editor.
  const detailsStatus = useRef<SaveStatus>("saved");
  const termsStatus = useRef<SaveStatus>("saved");
  const editorStatus = () => combineStatuses([detailsStatus.current, termsStatus.current]);
  // Where to go once the pending saves succeed, and the view that asked for it.
  const leaveWhenSaved = useRef<{ from: string; to: Destination } | null>(null);
  // The set whose unsaved changes the user chose to discard; its editor must not save them.
  const discardedSetId = useRef<number | null>(null);

  // A pending "leave" or "discard" belongs to the view it was requested in. This runs
  // after the old editor's unmount cleanups (which read discardedSetId).
  useEffect(() => {
    leaveWhenSaved.current = null;
    discardedSetId.current = null;
    detailsStatus.current = "saved";
    termsStatus.current = "saved";
  }, [viewKey]);

  const handleEditorStatus = () => {
    const pending = leaveWhenSaved.current;
    const status = editorStatus();
    if (pending !== null && status !== "saving") {
      leaveWhenSaved.current = null;
      // After a failed save, stay so the error is visible. Anything else unsaved (such
      // as a typed but not added term) gets the usual confirmation.
      if (pending.from === viewKey && status !== "error" && confirmLeave("Leave")) {
        navigateTo(pending.to);
      }
    }
  };

  /** Confirms discarding unsaved changes; true when there's nothing to lose or the user agrees. */
  const confirmLeave = (action: string): boolean => {
    const status = editorStatus();
    if (!editingSet || studyMode !== null || status === "saved") {
      return true;
    }
    const message =
      status === "saving"
        ? `Your study set changes are still being saved. ${action} anyway? Changes that haven't finished saving may be lost.`
        : `Your latest changes to this study set haven't been saved. Discard them and ${action.toLowerCase()}?`;
    if (!window.confirm(message)) {
      return false;
    }
    discardedSetId.current = editingSet.id;
    return true;
  };

  useImperativeHandle(ref, () => ({ confirmLeave }));

  const leaveEditor = (to: Destination) => {
    if (editorStatus() === "saving") {
      leaveWhenSaved.current = { from: viewKey, to };
      return;
    }
    if (confirmLeave("Leave")) {
      navigateTo(to);
    }
  };

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

  if (editingSet && studyMode) {
    return (
      <StudySession
        studySet={editingSet}
        mode={studyMode}
        headingRef={sessionHeadingRef}
        onChangeMode={(mode) => navigateTo({ set: editingParam, study: mode })}
        onExit={() => navigateTo({ set: editingParam })}
      />
    );
  }

  if (editingSet) {
    const termCount = editingSet.termCount;
    return (
      <div ref={setPageRef} className="flex flex-col gap-6">
        <section className="card-active flex flex-col gap-5" aria-labelledby={`set-${editingSet.id}-title`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow m-0">
                Study set · {termCount === 1 ? "1 term" : `${termCount} terms`}
              </p>
              <h2
                id={`set-${editingSet.id}-title`}
                ref={editorHeadingRef}
                className="page-title break-words"
                tabIndex={-1}
              >
                {editingSet.title}
              </h2>
              {editingSet.description && (
                <p className="mt-1 mb-0 max-w-2xl text-muted">{editingSet.description}</p>
              )}
            </div>
            <button className="btn-secondary" onClick={() => leaveEditor({ set: null })}>
              Back to study sets
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="section-title">Study</h3>
            <StudyModeSelector
              termCount={termCount}
              onSelect={(mode) => leaveEditor({ set: editingParam, study: mode })}
            />
          </div>
        </section>

        <section className="card flex flex-col gap-5" aria-labelledby={`set-${editingSet.id}-edit`}>
          <h3 id={`set-${editingSet.id}-edit`} className="section-title">
            Edit set
          </h3>
          <StudySetForm
            key={editingSet.id}
            studySet={editingSet}
            onSaved={(updated) => replaceSet(updated)}
            onStatusChange={(status) => {
              detailsStatus.current = status;
              handleEditorStatus();
            }}
            isDiscarded={() => discardedSetId.current === editingSet.id}
          />
          <TermEditor
            key={editingSet.id}
            studySetId={editingSet.id}
            onTermCountChanged={(termCount) =>
              setStudySets((current) =>
                current.map((s) => (s.id === editingSet.id ? { ...s, termCount } : s)),
              )
            }
            onStatusChange={(status) => {
              termsStatus.current = status;
              handleEditorStatus();
            }}
            isDiscarded={() => discardedSetId.current === editingSet.id}
          />
        </section>
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
