import { useState } from "react";
import { apiPatch, apiPost, ApiError } from "../api/client";
import type { StudySet } from "../api/types";

type StudySetFormProps = {
  /** When provided the form edits this set; otherwise it creates a new one. */
  studySet?: StudySet;
  onSaved: (studySet: StudySet) => void;
  onCancel?: () => void;
};

function StudySetForm({ studySet, onSaved, onCancel }: StudySetFormProps) {
  const isEditing = studySet !== undefined;
  const [title, setTitle] = useState(studySet?.title ?? "");
  const [description, setDescription] = useState(studySet?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    !isEditing || title !== studySet.title || description !== (studySet.description ?? "");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (title.trim() === "") {
      setError("Title is required");
      return;
    }

    try {
      setIsSaving(true);
      const saved = isEditing
        ? await apiPatch<StudySet>(`/api/study-sets/${studySet.id}`, { title, description })
        : await apiPost<StudySet>("/api/study-sets", { title, description });
      onSaved(saved);
      if (!isEditing) {
        setTitle("");
        setDescription("");
      }
    } catch (err) {
      console.error("Error saving study set:", err);
      setError(err instanceof ApiError ? err.message : "Failed to save study set. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {error && <p className="m-0 text-red-600">{error}</p>}
      <label className="flex flex-col gap-1 text-sm font-bold text-muted">
        Title
        <input
          className="field w-full font-normal text-ink"
          placeholder="e.g. Spanish vocabulary, chapter 3"
          value={title}
          disabled={isSaving}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold text-muted">
        Description (optional)
        <textarea
          className="field min-h-20 w-full resize-y font-normal text-ink"
          placeholder="What is this set about?"
          value={description}
          disabled={isSaving}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2.5">
        <button
          className="btn-primary"
          type="submit"
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Saving..." : isEditing ? "Save set details" : "Create study set"}
        </button>
        {onCancel && (
          <button className="btn-secondary" type="button" disabled={isSaving} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default StudySetForm;
