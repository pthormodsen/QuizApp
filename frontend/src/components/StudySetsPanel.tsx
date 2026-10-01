import { useEffect, useRef, useState } from "react";
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

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

  const editingSet = studySets.find((studySet) => studySet.id === editingId) ?? null;

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
      if (editingId === studySet.id) {
        setEditingId(null);
      }
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

  if (editingSet) {
    return (
      <div className="card-active flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="eyebrow">Editing study set</span>
          <button className="btn-secondary" onClick={() => setEditingId(null)}>
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
          <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
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
          <h3 className="section-title mb-4">Create study set</h3>
          <StudySetForm
            onCancel={() => setShowCreateForm(false)}
            onSaved={(created) => {
              setStudySets((current) => [created, ...current]);
              setShowCreateForm(false);
              setEditingId(created.id);
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
            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
              New study set
            </button>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studySets.map((studySet) => (
            <StudySetCard
              key={studySet.id}
              studySet={studySet}
              onOpen={() => setEditingId(studySet.id)}
              onDelete={() => deleteSet(studySet)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default StudySetsPanel;
