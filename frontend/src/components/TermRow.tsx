import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { apiDelete, apiPatch } from "../api/client";
import type { Term } from "../api/types";
import Alert from "./Alert";
import TermFields from "./TermFields";
import {
  describeSaveError,
  hasFieldErrors,
  validateTerm,
  type FieldErrors,
  type SaveStatus,
  type TermField,
  type TermValues,
} from "./formValidation";

const FIELDS: readonly TermField[] = ["term", "definition"];

// The backend trims both fields, so whitespace-only edits are not real changes.
function normalize(values: TermValues): TermValues {
  return { term: values.term.trim(), definition: values.definition.trim() };
}

function sameValues(a: TermValues, b: TermValues): boolean {
  return a.term === b.term && a.definition === b.definition;
}

function toValues(term: Term): TermValues {
  return { term: term.term, definition: term.definition };
}

type TermRowProps = {
  studySetId: number;
  term: Term;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  onUpdated: (term: Term) => void;
  onDeleted: (termId: number) => void;
  onMove: (direction: -1 | 1) => void;
  onStatusChange: (termId: number, status: SaveStatus) => void;
  /** Asked on unmount: true means the user chose to discard unsaved changes. */
  isDiscarded?: () => boolean;
};

/**
 * One existing term. Changes save when focus leaves the row or on Cmd/Ctrl+Enter;
 * Escape restores the last saved values. Also move up/down and delete.
 */
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
  onStatusChange,
  isDiscarded,
}: TermRowProps) {
  const [values, setValues] = useState<TermValues>(() => toValues(term));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TermField>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Shows "Saved" after this row was saved, until it's edited again.
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = !sameValues(normalize(values), toValues(term));
  const hasErrors = error !== null || hasFieldErrors(fieldErrors);
  const status: SaveStatus = isSaving
    ? "saving"
    : !isDirty
      ? "saved"
      : hasErrors
        ? "error"
        : "unsaved";

  // Saves start from event handlers and may overlap with further edits, so the latest
  // values live in refs as well as state (same approach as StudySetForm).
  const latest = useRef({ values, term, onUpdated, isDiscarded });
  useEffect(() => {
    latest.current = { values, term, onUpdated, isDiscarded };
  });
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const unmounted = useRef(false);
  const deleted = useRef(false);

  useEffect(() => {
    onStatusChange(term.id, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const saveChanges = async () => {
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }
    const confirmed = toValues(latest.current.term);
    const draft = normalize(latest.current.values);
    if (sameValues(draft, confirmed)) {
      setFieldErrors({});
      setError(null);
      return;
    }
    const errors = validateTerm(draft);
    setFieldErrors(errors);
    setError(null);
    if (hasFieldErrors(errors)) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    let succeeded = false;
    try {
      const updated = await apiPatch<Term>(`/api/study-sets/${studySetId}/terms/${term.id}`, draft);
      latest.current.term = updated;
      // Show the stored (trimmed) values, unless the user has typed something new meanwhile.
      setValues((current) => ({
        term: current.term.trim() === draft.term ? updated.term : current.term,
        definition:
          current.definition.trim() === draft.definition ? updated.definition : current.definition,
      }));
      setJustSaved(true);
      latest.current.onUpdated(updated);
      succeeded = true;
    } catch (err) {
      console.error("Error updating term:", err);
      const described = describeSaveError(err, FIELDS, "Couldn't save this term. Please try again.");
      setFieldErrors(described.fieldErrors);
      setError(described.message);
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
      if (saveQueued.current) {
        saveQueued.current = false;
        // While mounted, a failure stays visible for the user to retry. After unmounting
        // nobody can retry, so the latest values get one more attempt either way.
        if (succeeded || unmounted.current) {
          void saveChanges();
        }
      }
    }
  };

  // Leaving the editor while this row has unsaved changes still saves them, unless the
  // row was deleted or the user chose to discard them. Failures after that are only logged.
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (deleted.current || latest.current.isDiscarded?.()) {
        saveQueued.current = false;
        return;
      }
      void saveChanges();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revert = () => {
    setValues(toValues(latest.current.term));
    setFieldErrors({});
    setError(null);
    saveQueued.current = false;
  };

  const handleBlur = (event: FocusEvent<HTMLLIElement>) => {
    // Moving between this row's own fields and buttons doesn't count as leaving it.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    // Drop whitespace-only edits so the fields show what is actually stored.
    if (sameValues(normalize(values), toValues(term)) && !sameValues(values, toValues(term))) {
      setValues(toValues(term));
    }
    void saveChanges();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveChanges();
    } else if (event.key === "Escape" && isDirty && !saveInFlight.current) {
      // Ignored while saving: the running save would land after the revert.
      event.preventDefault();
      revert();
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${term.term}"?`)) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiDelete(`/api/study-sets/${studySetId}/terms/${term.id}`);
      deleted.current = true;
      onDeleted(term.id);
    } catch (err) {
      console.error("Error deleting term:", err);
      setDeleteError(describeSaveError(err, [], "Failed to delete term. Please try again.").message);
      setIsDeleting(false);
    }
  };

  const disabled = isDeleting || isReordering;
  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "error"
        ? "Couldn't save"
        : status === "unsaved"
          ? "Unsaved"
          : justSaved
            ? "Saved"
            : "";

  return (
    <li className="card flex flex-col gap-3 p-3.5" data-term-id={term.id} onBlur={handleBlur}>
      <div className="-my-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-bold text-muted" aria-hidden="true">
            {position}
          </span>
          <span
            className={`text-xs ${status === "error" ? "font-semibold text-danger" : "text-muted"}`}
            role="status"
          >
            {statusLabel && <span className="sr-only">{`Term ${position}: `}</span>}
            {statusLabel}
          </span>
        </div>
        <div className="-mr-1.5 flex">
          <IconButton
            label={`Move "${term.term}" up`}
            data-move="up"
            disabled={disabled || isFirst}
            onClick={() => onMove(-1)}
          >
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </IconButton>
          <IconButton
            label={`Move "${term.term}" down`}
            data-move="down"
            disabled={disabled || isLast}
            onClick={() => onMove(1)}
          >
            <path d="M12 5v14m6-6-6 6-6-6" />
          </IconButton>
          <IconButton
            label={`Delete "${term.term}"`}
            data-delete
            danger
            disabled={disabled}
            onClick={remove}
          >
            <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
          </IconButton>
        </div>
      </div>
      <TermFields
        values={values}
        errors={fieldErrors}
        labelSuffix={String(position)}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onChange={(field, value) => {
          setValues((current) => ({ ...current, [field]: value }));
          setFieldErrors((current) => ({ ...current, [field]: undefined }));
          setJustSaved(false);
        }}
      />
      {deleteError && <Alert message={deleteError} onDismiss={() => setDeleteError(null)} />}
      {error && (
        <Alert
          message={error}
          onRetry={isDirty ? () => void saveChanges() : undefined}
          onDismiss={isDirty ? revert : () => setError(null)}
          dismissLabel={isDirty ? "Undo changes" : "Dismiss"}
        />
      )}
    </li>
  );
}

function IconButton({
  label,
  danger = false,
  disabled,
  onClick,
  children,
  ...data
}: {
  label: string;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
  [dataAttribute: `data-${string}`]: string | boolean;
}) {
  return (
    <button
      type="button"
      className={`btn-icon ${danger ? "hover:enabled:text-danger" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      {...data}
    >
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
        {children}
      </svg>
    </button>
  );
}

export default TermRow;
