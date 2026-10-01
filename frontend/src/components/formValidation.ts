import { ApiError } from "../api/client";

// Input limits mirroring the backend's @Size constraints in dto/studyset.
export const STUDY_SET_LIMITS = { title: 200, description: 1000 } as const;
export const TERM_LIMITS = { term: 500, definition: 1000 } as const;

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** Save state of an autosaving form (study set details, a term row). */
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/**
 * The state of several autosaving parts as a whole: "saving" while anything is still
 * saving (so callers can wait), otherwise the most serious remaining state.
 */
export function combineStatuses(statuses: Iterable<SaveStatus>): SaveStatus {
  let combined: SaveStatus = "saved";
  for (const status of statuses) {
    if (status === "saving") {
      return "saving";
    }
    if (status === "error" || (status === "unsaved" && combined === "saved")) {
      combined = status;
    }
  }
  return combined;
}

export function hasFieldErrors(errors: FieldErrors<string>): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Splits a failed save into errors for the form's own fields and a general message.
 * Backend field errors for known fields are shown next to those fields; the generic
 * "Validation failed" message is only shown when nothing more specific is available.
 */
export function describeSaveError<F extends string>(
  err: unknown,
  fields: readonly F[],
  fallback: string,
): { fieldErrors: FieldErrors<F>; message: string | null } {
  if (!(err instanceof ApiError)) {
    return { fieldErrors: {}, message: fallback };
  }

  const fieldErrors: FieldErrors<F> = {};
  const otherMessages: string[] = [];
  for (const [field, message] of Object.entries(err.fieldErrors ?? {})) {
    if ((fields as readonly string[]).includes(field)) {
      fieldErrors[field as F] = message;
    } else {
      otherMessages.push(message);
    }
  }

  if (otherMessages.length > 0) {
    return { fieldErrors, message: otherMessages.join(" ") };
  }
  return { fieldErrors, message: hasFieldErrors(fieldErrors) ? null : err.message };
}

export type TermValues = { term: string; definition: string };
export type TermField = keyof TermValues;

export function validateTerm(values: TermValues): FieldErrors<TermField> {
  const errors: FieldErrors<TermField> = {};
  if (values.term.trim() === "") {
    errors.term = "Term is required";
  }
  if (values.definition.trim() === "") {
    errors.definition = "Definition is required";
  }
  return errors;
}
