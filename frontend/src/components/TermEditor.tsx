import { useEffect, useRef, useState } from "react";
import { apiGet, apiPatch } from "../api/client";
import type { Term } from "../api/types";
import AddTermForm from "./AddTermForm";
import Alert from "./Alert";
import Skeleton from "./Skeleton";
import TermRow from "./TermRow";
import { combineStatuses, describeSaveError, type SaveStatus } from "./formValidation";

type TermEditorProps = {
  studySetId: number;
  onTermCountChanged: (count: number) => void;
  /** Reports the combined save state of all terms (plus an un-added new term as "unsaved"). */
  onStatusChange?: (status: SaveStatus) => void;
  /** Asked when rows unmount: true means the user chose to discard unsaved changes. */
  isDiscarded?: () => boolean;
};

// Shown next to the shortcut hint; Cmd on Apple devices, Ctrl elsewhere.
const SAVE_SHORTCUT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";

function TermEditor({
  studySetId,
  onTermCountChanged,
  onStatusChange,
  isDiscarded,
}: TermEditorProps) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  // Per-row save states plus the add-term draft, combined into one status for the parent.
  const rowStatuses = useRef(new Map<number, SaveStatus>());
  const hasNewTermDraft = useRef(false);
  const combinedStatus = useRef<SaveStatus>("saved");
  const reportStatus = () => {
    const status = combineStatuses([
      ...rowStatuses.current.values(),
      hasNewTermDraft.current ? "unsaved" : "saved",
    ]);
    if (status !== combinedStatus.current) {
      combinedStatus.current = status;
      onStatusChange?.(status);
    }
  };

  // Reloading or closing the page would lose unsaved or failed term edits.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (combinedStatus.current !== "saved") {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const newTermRef = useRef<HTMLTextAreaElement>(null);
  // Moving or deleting a term drops focus (its buttons get disabled or removed);
  // remember where to put it back once the list has re-rendered.
  const pendingFocus = useRef<
    { termId: number; selectors: string[] } | { newTerm: true } | null
  >(null);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchTerms() {
      setIsLoading(true);
      setLoadError(null);
      setTerms([]);
      rowStatuses.current.clear();
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
    const pending = pendingFocus.current;
    if (isReordering || !pending) {
      return;
    }
    pendingFocus.current = null;
    const active = document.activeElement as HTMLButtonElement | null;
    if (active && active !== document.body && !active.disabled) {
      return; // focus survived or the user already moved on to something else
    }
    if ("newTerm" in pending) {
      newTermRef.current?.focus();
      return;
    }
    const row = listRef.current?.querySelector(`[data-term-id="${pending.termId}"]`);
    const target = pending.selectors
      .map((selector) => row?.querySelector<HTMLButtonElement>(selector))
      .find((button) => button && !button.disabled);
    target?.focus();
  }, [terms, isReordering]);

  const moveTerm = async (index: number, direction: -1 | 1) => {
    const reordered = [...terms];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + direction, 0, moved);
    // At the top/bottom the same-direction button is disabled, so fall back to the other one.
    const [same, other] = direction === -1 ? ["up", "down"] : ["down", "up"];
    pendingFocus.current = {
      termId: moved.id,
      selectors: [`[data-move="${same}"]`, `[data-move="${other}"]`],
    };

    setReorderError(null);
    setIsReordering(true);
    try {
      const result = await apiPatch<Term[]>(`/api/study-sets/${studySetId}/terms/reorder`, {
        termIds: reordered.map((term) => term.id),
      });
      // Take only the new order: a term saved while the reorder ran may be newer than
      // the copy in this response.
      setTerms((current) => result.map((t) => current.find((c) => c.id === t.id) ?? t));
      const position = result.findIndex((term) => term.id === moved.id) + 1;
      setAnnouncement(`Moved "${moved.term}" to position ${position} of ${result.length}.`);
    } catch (err) {
      console.error("Error reordering terms:", err);
      setReorderError(
        describeSaveError(err, [], "Failed to reorder terms. Please try again.").message,
      );
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
      <h3 className="section-title">
        Terms <span className="font-normal text-muted">({terms.length})</span>
      </h3>
      {terms.length > 0 && (
        <p className="m-0 text-sm text-muted">
          Changes save automatically when you leave a term. Press {SAVE_SHORTCUT}+Enter to save
          now, or Esc to undo unsaved changes.
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
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
                // Focus the term that takes the deleted one's place (or the one before it),
                // or the new-term input once the list is empty.
                const neighbor = terms[index + 1] ?? terms[index - 1];
                pendingFocus.current = neighbor
                  ? { termId: neighbor.id, selectors: ["[data-delete]"] }
                  : { newTerm: true };
                setTerms((current) => current.filter((t) => t.id !== termId));
                rowStatuses.current.delete(termId);
                reportStatus();
                setAnnouncement(`Deleted "${term.term}".`);
              }}
              onMove={(direction) => moveTerm(index, direction)}
              onStatusChange={(termId, status) => {
                rowStatuses.current.set(termId, status);
                reportStatus();
              }}
              isDiscarded={isDiscarded}
            />
          ))}
        </ol>
      )}
      <AddTermForm
        studySetId={studySetId}
        termRef={newTermRef}
        onDraftChange={(hasDraft) => {
          hasNewTermDraft.current = hasDraft;
          reportStatus();
        }}
        onCreated={(term) => setTerms((current) => [...current, term])}
      />
    </section>
  );
}

export default TermEditor;
