import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { apiPost } from "../api/client";
import type { Term } from "../api/types";
import Alert from "./Alert";
import TermFields from "./TermFields";
import {
  describeSaveError,
  hasFieldErrors,
  validateTerm,
  type FieldErrors,
  type TermField,
  type TermValues,
} from "./formValidation";

const FIELDS: readonly TermField[] = ["term", "definition"];
const EMPTY: TermValues = { term: "", definition: "" };

type AddTermFormProps = {
  studySetId: number;
  onCreated: (term: Term) => void;
  /** The "New term" input, so the editor can move focus here (e.g. after deleting the last term). */
  termRef?: RefObject<HTMLTextAreaElement | null>;
  /** Reports whether the form holds a typed but not yet added term. */
  onDraftChange?: (hasDraft: boolean) => void;
};

function AddTermForm({ studySetId, onCreated, termRef, onDraftChange }: AddTermFormProps) {
  const [values, setValues] = useState<TermValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TermField>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const localTermRef = useRef<HTMLTextAreaElement>(null);
  const termInputRef = termRef ?? localTermRef;
  const headingId = useId();
  const hasDraft = values.term.trim() !== "" || values.definition.trim() !== "";

  useEffect(() => {
    onDraftChange?.(hasDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDraft]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter calls requestSubmit(), which ignores the disabled submit button.
    if (isSubmitting) {
      return;
    }
    const errors = validateTerm(values);
    setFieldErrors(errors);
    setError(null);
    if (hasFieldErrors(errors)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await apiPost<Term>(`/api/study-sets/${studySetId}/terms`, values);
      onCreated(created);
      setValues(EMPTY);
      termInputRef.current?.focus();
    } catch (err) {
      console.error("Error creating term:", err);
      const described = describeSaveError(err, FIELDS, "Failed to add term. Please try again.");
      setFieldErrors(described.fieldErrors);
      setError(described.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="card flex flex-col gap-3 border-dashed p-3.5"
      aria-labelledby={headingId}
      noValidate
      onSubmit={handleSubmit}
    >
      <h4 id={headingId} className="eyebrow m-0">
        Add a term
      </h4>
      {error && <Alert message={error} />}
      <TermFields
        values={values}
        errors={fieldErrors}
        labelPrefix="New"
        readOnly={isSubmitting}
        termRef={termInputRef}
        onChange={(field, value) => {
          setValues((current) => ({ ...current, [field]: value }));
          setFieldErrors((current) => ({ ...current, [field]: undefined }));
        }}
        onKeyDown={(event) => {
          // Like the single-line inputs this form used to have, Enter adds the term;
          // Shift+Enter inserts a line break.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button className="btn-primary self-start" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Adding…" : "Add term"}
      </button>
    </form>
  );
}

export default AddTermForm;
