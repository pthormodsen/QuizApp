import { useId } from "react";
import type { KeyboardEventHandler, Ref } from "react";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { TERM_LIMITS, type FieldErrors, type TermField, type TermValues } from "./formValidation";

type TermFieldsProps = {
  values: TermValues;
  errors: FieldErrors<TermField>;
  onChange: (field: TermField, value: string) => void;
  /** Extra words around the label in the fields' accessible names, e.g. "New" or the position. */
  labelPrefix?: string;
  labelSuffix?: string;
  disabled?: boolean;
  readOnly?: boolean;
  termRef?: Ref<HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
};

const FIELDS: Array<[field: TermField, label: string]> = [
  ["term", "Term"],
  ["definition", "Definition"],
];

/** The labelled term + definition inputs shared by existing terms and the add-term form. */
function TermFields({
  values,
  errors,
  onChange,
  labelPrefix,
  labelSuffix,
  disabled,
  readOnly,
  termRef,
  onKeyDown,
}: TermFieldsProps) {
  const id = useId();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map(([field, label]) => {
        const inputId = `${id}-${field}`;
        const errorId = `${inputId}-error`;
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <label className="label" htmlFor={inputId}>
              {label}
            </label>
            <AutoGrowTextarea
              ref={field === "term" ? termRef : undefined}
              id={inputId}
              // Distinguishes the many "Term" fields for screen readers ("Term 3", "New Term")
              // while still containing the visible label text.
              aria-label={[labelPrefix, label, labelSuffix].filter(Boolean).join(" ")}
              className="field min-h-11 w-full resize-none"
              value={values[field]}
              maxLength={TERM_LIMITS[field]}
              required
              aria-invalid={errors[field] ? true : undefined}
              aria-describedby={errors[field] ? errorId : undefined}
              disabled={disabled}
              readOnly={readOnly}
              onChange={(e) => onChange(field, e.target.value)}
              onKeyDown={onKeyDown}
            />
            {errors[field] && (
              <p id={errorId} className="field-error">
                {errors[field]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TermFields;
