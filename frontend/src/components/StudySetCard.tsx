import type { StudySet } from "../api/types";

function termCountLabel(count: number): string {
  return count === 1 ? "1 term" : `${count} terms`;
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function updatedLabel(iso: string): string | null {
  const updated = new Date(iso).getTime();
  if (Number.isNaN(updated)) {
    return null;
  }
  const seconds = Math.round((updated - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return `Updated ${relativeTime.format(Math.round(seconds / size), unit)}`;
    }
  }
  return "Updated just now";
}

type StudySetCardProps = {
  studySet: StudySet;
  onOpen: () => void;
  onDelete: () => void;
};

function StudySetCard({ studySet, onOpen, onDelete }: StudySetCardProps) {
  const updated = updatedLabel(studySet.updatedAt);

  return (
    <article className="card-interactive relative flex min-h-36 flex-col gap-2">
      <h3 className="m-0 text-lg font-semibold">
        {/* The overlay makes the whole card clickable while keeping one tab stop. */}
        <button
          type="button"
          className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
          onClick={onOpen}
        >
          {studySet.title}
        </button>
      </h3>
      <span className="inline-flex w-fit rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-primary-strong">
        {termCountLabel(studySet.termCount)}
      </span>
      {studySet.description && (
        <p className="m-0 line-clamp-2 text-sm text-muted">{studySet.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
        <span>{updated}</span>
        <button
          type="button"
          className="btn-icon relative z-10 -mr-2 -mb-2 hover:enabled:text-danger"
          aria-label={`Delete "${studySet.title}"`}
          title="Delete set"
          onClick={onDelete}
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
            <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
          </svg>
        </button>
      </div>
    </article>
  );
}

export default StudySetCard;
