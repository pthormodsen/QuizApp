/** Pulsing grey placeholder block; size it with className. */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-border/60 ${className}`} aria-hidden="true" />;
}

/** Placeholder shaped like a content card, used while lists load. */
export function SkeletonCard() {
  return (
    <div className="card flex min-h-36 flex-col gap-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

export default Skeleton;
