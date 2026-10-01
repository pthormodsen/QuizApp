import { useEffect, useId, useRef, useState } from "react";
import { apiPatch, apiPost } from "../api/client";
import type { StudySet } from "../api/types";
import Alert from "./Alert";
import AutoGrowTextarea from "./AutoGrowTextarea";
import {
  describeSaveError,
  hasFieldErrors,
  STUDY_SET_LIMITS,
  type FieldErrors,
  type SaveStatus,
} from "./formValidation";

type Details = { title: string; description: string };
type Field = keyof Details;

const FIELDS: readonly Field[] = ["title", "description"];

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Couldn't save",
};

function toDetails(studySet?: StudySet): Details {
  return { title: studySet?.title ?? "", description: studySet?.description ?? "" };
}

// The backend trims both fields, so whitespace-only edits are not real changes.
function normalize(details: Details): Details {
  return { title: details.title.trim(), description: details.description.trim() };
}

function sameDetails(a: Details, b: Details): boolean {
  return a.title === b.title && a.description === b.description;
}

function validate(details: Details): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  if (details.title === "") {
    errors.title = "Title is required";
  } else if (details.title.length > STUDY_SET_LIMITS.title) {
    errors.title = `Title must be at most ${STUDY_SET_LIMITS.title} characters`;
  }
  if (details.description.length > STUDY_SET_LIMITS.description) {
    errors.description = `Description must be at most ${STUDY_SET_LIMITS.description} characters`;
  }
  return errors;
}

type StudySetFormProps = {
  /**
   * When provided the form edits this set and saves each changed field when it loses
   * focus; otherwise it creates a new set, only when the user submits.
   */
  studySet?: StudySet;
  onSaved: (studySet: StudySet) => void;
  onCancel?: () => void;
  /** Edit mode only: reports the save state so the parent can guard leaving the editor. */
  onStatusChange?: (status: SaveStatus) => void;
  /**
   * Edit mode only: asked when the form unmounts. True means the user explicitly chose to
   * discard their unsaved changes, so they must not be saved in the background.
   */
  isDiscarded?: () => boolean;
};

function StudySetForm({
  studySet,
  onSaved,
  onCancel,
  onStatusChange,
  isDiscarded,
}: StudySetFormProps) {
  const isEditing = studySet !== undefined;
  const [values, setValues] = useState<Details>(() => toDetails(studySet));
  // Last values the server confirmed; the baseline for "is anything unsaved?".
  const [saved, setSaved] = useState<Details>(() => normalize(toDetails(studySet)));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  const isDirty = !sameDetails(normalize(values), saved);
  const hasErrors = formError !== null || hasFieldErrors(fieldErrors);
  const status: SaveStatus = isSaving
    ? "saving"
    : !isDirty
      ? "saved"
      : hasErrors
        ? "error"
        : "unsaved";
  const hasUnsavedChanges = isEditing
    ? status !== "saved"
    : values.title.trim() !== "" || values.description.trim() !== "";

  // Saves are triggered from blur handlers and may overlap with further edits, so the
  // latest values live in refs as well as state.
  const latest = useRef({ values, saved, onSaved, isDiscarded });
  useEffect(() => {
    latest.current = { values, saved, onSaved, isDiscarded };
  });
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const unmounted = useRef(false);

  useEffect(() => {
    if (isEditing) {
      onStatusChange?.(status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isEditing]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const saveChanges = async () => {
    if (!isEditing) {
      return;
    }
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }
    const draft = normalize(latest.current.values);
    if (sameDetails(draft, latest.current.saved)) {
      // Back to the stored values: any earlier error no longer applies.
      setFieldErrors({});
      setFormError(null);
      return;
    }
    const errors = validate(draft);
    setFieldErrors(errors);
    setFormError(null);
    if (hasFieldErrors(errors)) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    let succeeded = false;
    try {
      const updated = await apiPatch<StudySet>(`/api/study-sets/${studySet.id}`, draft);
      const confirmed = normalize(toDetails(updated));
      latest.current.saved = confirmed;
      setSaved(confirmed);
      // Show the stored (trimmed) values, unless the user has typed something new meanwhile.
      setValues((current) => ({
        title: current.title.trim() === draft.title ? confirmed.title : current.title,
        description:
          current.description.trim() === draft.description
            ? confirmed.description
            : current.description,
      }));
      latest.current.onSaved(updated);
      succeeded = true;
    } catch (err) {
      console.error("Error saving study set:", err);
      const described = describeSaveError(err, FIELDS, "Couldn't save your changes. Please try again.");
      setFieldErrors(described.fieldErrors);
      setFormError(described.message);
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

  // Leaving the editor without blurring first (e.g. browser Back while typing) still
  // saves valid changes, unless the user chose to discard them. If a save is in flight,
  // the latest values are saved once it finishes. Failures can't be shown anymore, so
  // they're only logged.
  useEffect(() => {
    const state = latest;
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (!isEditing) {
        return;
      }
      if (state.current.isDiscarded?.()) {
        saveQueued.current = false;
        return;
      }
      void saveChanges();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleBlur = (field: Field) => {
    if (!isEditing) {
      return;
    }
    // Drop whitespace-only edits so the field shows what is actually stored.
    if (values[field].trim() === saved[field] && values[field] !== saved[field]) {
      setValues((current) => ({ ...current, [field]: saved[field] }));
    }
    void saveChanges();
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = normalize(values);
    const errors = validate(draft);
    setFieldErrors(errors);
    setFormError(null);
    if (hasFieldErrors(errors)) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await apiPost<StudySet>("/api/study-sets", draft);
      setValues(toDetails());
      onSaved(created);
    } catch (err) {
      console.error("Error creating study set:", err);
      const described = describeSaveError(
        err,
        FIELDS,
        "Couldn't create the study set. Please try again.",
      );
      setFieldErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !window.confirm("Discard this new study set?")) {
      return;
    }
    onCancel?.();
  };

  const titleErrorId = `${titleId}-error`;
  const descriptionErrorId = `${descriptionId}-error`;
  // Inputs are only locked while creating; in edit mode the user can keep typing during a save.
  const locked = !isEditing && isSaving;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={
        isEditing
          ? (event) => {
              // Enter in the title saves right away.
              event.preventDefault();
              void saveChanges();
            }
          : handleCreate
      }
    >
      {/* Nothing is left to retry once the form is back to the stored values. */}
      {formError && (isDirty || !isEditing) && (
        <Alert
          message={formError}
          onRetry={isEditing ? () => void saveChanges() : undefined}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label className="label" htmlFor={titleId}>
          Title
        </label>
        <input
          id={titleId}
          className="field w-full"
          placeholder="e.g. Spanish vocabulary, chapter 3"
          value={values.title}
          maxLength={STUDY_SET_LIMITS.title}
          required
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? titleErrorId : undefined}
          disabled={locked}
          onChange={(e) => handleChange("title", e.target.value)}
          onBlur={() => handleBlur("title")}
        />
        {fieldErrors.title && (
          <p id={titleErrorId} className="field-error">
            {fieldErrors.title}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label" htmlFor={descriptionId}>
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <AutoGrowTextarea
          id={descriptionId}
          className="field min-h-20 w-full resize-none"
          placeholder="What is this set about?"
          value={values.description}
          maxLength={STUDY_SET_LIMITS.description}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={fieldErrors.description ? descriptionErrorId : undefined}
          disabled={locked}
          onChange={(e) => handleChange("description", e.target.value)}
          onBlur={() => handleBlur("description")}
        />
        {fieldErrors.description && (
          <p id={descriptionErrorId} className="field-error">
            {fieldErrors.description}
          </p>
        )}
      </div>
      {isEditing ? (
        <p
          className={`m-0 text-sm ${status === "error" ? "font-semibold text-danger" : "text-muted"}`}
          role="status"
        >
          {STATUS_LABELS[status]}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <button className="btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create study set"}
          </button>
          {onCancel && (
            <button
              className="btn-secondary"
              type="button"
              disabled={isSaving}
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export default StudySetForm;
