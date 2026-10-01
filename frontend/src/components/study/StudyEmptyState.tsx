import type { ReactNode } from "react";

/** Shown when a set doesn't have enough terms for the chosen study mode. */
function StudyEmptyState({ children, onExit }: { children: ReactNode; onExit: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <h3 className="section-title">Not enough terms yet</h3>
      <p className="m-0 max-w-sm text-muted">{children}</p>
      <button className="btn-primary" type="button" onClick={onExit}>
        Back to set
      </button>
    </div>
  );
}

export default StudyEmptyState;
