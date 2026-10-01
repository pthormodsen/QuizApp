import { useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../api/client";
import type { Term } from "../api/types";
import Alert from "./Alert";
import Skeleton from "./Skeleton";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function TermRow({
  studySetId,
  term,
  position,
  isFirst,
  isLast,
  isReordering,
  onUpdated,
  onDeleted,
  onMove,
}: {
  studySetId: number;
  term: Term;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  onUpdated: (term: Term) => void;
  onDeleted: (termId: number) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [termText, setTermText] = useState(term.term);
  const [definition, setDefinition] = useState(term.definition);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isDirty = termText !== term.term || definition !== term.definition;

  const save = async () => {
    setError(null);
    if (termText.trim() === "" || definition.trim() === "") {
      setError("Both term and definition are required");
      return;
    }
    setIsBusy(true);
    try {
      const updated = await apiPatch<Term>(`/api/study-sets/${studySetId}/terms/${term.id}`, {
        term: termText,
        definition,
      });
      setTermText(updated.term);
      setDefinition(updated.definition);
      onUpdated(updated);
    } catch (err) {
      console.error("Error updating term:", err);
      setError(errorMessage(err, "Failed to save term. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${term.term}"?`)) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      await apiDelete(`/api/study-sets/${studySetId}/terms/${term.id}`);
      onDeleted(term.id);
    } catch (err) {
      console.error("Error deleting term:", err);
      setError(errorMessage(err, "Failed to delete term. Please try again."));
      setIsBusy(false);
    }
  };

  const disabled = isBusy || isReordering;

  return (
    <li className="card flex flex-col gap-2 p-3.5" data-term-id={term.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-muted">{position}</span>
        <div className="flex gap-1.5">
          <button
            className="btn-secondary px-3 text-sm"
            type="button"
            data-move="up"
            aria-label={`Move "${term.term}" up`}
            disabled={disabled || isFirst}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            className="btn-secondary px-3 text-sm"
            type="button"
            data-move="down"
            aria-label={`Move "${term.term}" down`}
            disabled={disabled || isLast}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            className="btn-danger px-3 text-sm"
            type="button"
            disabled={disabled}
            onClick={remove}
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="m-0 text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted uppercase">
          Term
          <textarea
            className="field min-h-11 resize-y text-base font-normal text-ink normal-case"
            rows={1}
            value={termText}
            disabled={disabled}
            onChange={(e) => setTermText(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted uppercase">
          Definition
          <textarea
            className="field min-h-11 resize-y text-base font-normal text-ink normal-case"
            rows={1}
            value={definition}
            disabled={disabled}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </label>
      </div>
      {isDirty && (
        <div className="flex gap-2">
          <button
            className="btn-primary px-3 text-sm"
            type="button"
            disabled={disabled}
            onClick={save}
          >
            {isBusy ? "Saving..." : "Save"}
          </button>
          <button
            className="btn-secondary px-3 text-sm"
            type="button"
            disabled={disabled}
            onClick={() => {
              setTermText(term.term);
              setDefinition(term.definition);
              setError(null);
            }}
          >
            Discard
          </button>
        </div>
      )}
    </li>
  );
}

function AddTermForm({
  studySetId,
  onCreated,
}: {
  studySetId: number;
  onCreated: (term: Term) => void;
}) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const termInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (term.trim() === "" || definition.trim() === "") {
      setError("Both term and definition are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await apiPost<Term>(`/api/study-sets/${studySetId}/terms`, {
        term,
        definition,
      });
      onCreated(created);
      setTerm("");
      setDefinition("");
      termInputRef.current?.focus();
    } catch (err) {
      console.error("Error creating term:", err);
      setError(errorMessage(err, "Failed to add term. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card flex flex-col gap-2 border-dashed p-3.5" onSubmit={handleSubmit}>
      <span className="eyebrow">Add a term</span>
      {error && <p className="m-0 text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          ref={termInputRef}
          className="field w-full"
          placeholder="Term"
          value={term}
          readOnly={isSubmitting}
          onChange={(e) => setTerm(e.target.value)}
        />
        <input
          className="field w-full"
          placeholder="Definition"
          value={definition}
          readOnly={isSubmitting}
          onChange={(e) => setDefinition(e.target.value)}
        />
      </div>
      <button
        className="btn-primary self-start"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Adding..." : "Add term"}
      </button>
    </form>
  );
}

type TermEditorProps = {
  studySetId: number;
  onTermCountChanged: (count: number) => void;
};

function TermEditor({ studySetId, onTermCountChanged }: TermEditorProps) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // Move buttons are disabled during a reorder, which drops focus; remember where to put it back.
  const pendingMoveFocus = useRef<{ termId: number; direction: -1 | 1 } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchTerms() {
      setIsLoading(true);
      setLoadError(null);
      setTerms([]);
      try {
        const result = await apiGet<Term[]>(
          `/api/study-sets/${studySetId}/terms`,
          controller.signal,
        );
        if (!cancelled) {
          setTerms(result);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("Failed to fetch terms:", error);
        setLoadError("Couldn't load the terms in this set.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchTerms();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [studySetId, reloadToken]);

  // Keep the set's term count in sync; only meaningful once the terms have loaded.
  useEffect(() => {
    if (!isLoading && !loadError) {
      onTermCountChanged(terms.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms.length, isLoading, loadError]);

  useEffect(() => {
    const pending = pendingMoveFocus.current;
    if (isReordering || !pending) {
      return;
    }
    pendingMoveFocus.current = null;
    const active = document.activeElement as HTMLButtonElement | null;
    if (active && active !== document.body && !active.disabled) {
      return; // focus survived or the user already moved on to something else
    }
    const row = listRef.current?.querySelector(`[data-term-id="${pending.termId}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(
      `[data-move="${pending.direction === -1 ? "up" : "down"}"]`,
    );
    const fallback = row?.querySelector<HTMLButtonElement>(
      `[data-move="${pending.direction === -1 ? "down" : "up"}"]`,
    );
    // At the top/bottom the same-direction button is disabled, so fall back to the other one.
    (preferred && !preferred.disabled ? preferred : fallback)?.focus();
  }, [isReordering]);

  const moveTerm = async (index: number, direction: -1 | 1) => {
    const reordered = [...terms];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + direction, 0, moved);
    pendingMoveFocus.current = { termId: moved.id, direction };

    setReorderError(null);
    setIsReordering(true);
    try {
      const result = await apiPatch<Term[]>(`/api/study-sets/${studySetId}/terms/reorder`, {
        termIds: reordered.map((term) => term.id),
      });
      setTerms(result);
    } catch (err) {
      console.error("Error reordering terms:", err);
      setReorderError(errorMessage(err, "Failed to reorder terms. Please try again."));
    } finally {
      setIsReordering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return <Alert message={loadError} onRetry={() => setReloadToken((token) => token + 1)} />;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 ref={headingRef} className="section-title" tabIndex={-1}>
        Terms <span className="font-normal text-muted">({terms.length})</span>
      </h3>
      {reorderError && <Alert message={reorderError} onDismiss={() => setReorderError(null)} />}
      {terms.length === 0 ? (
        <p className="m-0 text-muted">No terms yet. Add your first term below.</p>
      ) : (
        <ol ref={listRef} className="m-0 flex list-none flex-col gap-3 p-0">
          {terms.map((term, index) => (
            <TermRow
              key={term.id}
              studySetId={studySetId}
              term={term}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === terms.length - 1}
              isReordering={isReordering}
              onUpdated={(updated) =>
                setTerms((current) => current.map((t) => (t.id === updated.id ? updated : t)))
              }
              onDeleted={(termId) => {
                // The deleted row held focus; move it somewhere stable instead of <body>.
                headingRef.current?.focus();
                setTerms((current) => current.filter((t) => t.id !== termId));
              }}
              onMove={(direction) => moveTerm(index, direction)}
            />
          ))}
        </ol>
      )}
      <AddTermForm studySetId={studySetId} onCreated={(term) => setTerms((current) => [...current, term])} />
    </section>
  );
}

export default TermEditor;
