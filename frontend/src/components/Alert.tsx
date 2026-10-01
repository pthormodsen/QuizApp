type AlertProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};

/** Error banner announced to screen readers, with optional Retry / Dismiss actions. */
function Alert({ message, onRetry, onDismiss, dismissLabel = "Dismiss", className = "" }: AlertProps) {
  return (
    <div className={`alert-error ${className}`} role="alert">
      <p className="m-0">{message}</p>
      {(onRetry || onDismiss) && (
        <div className="flex gap-2">
          {onRetry && (
            <button className="btn-secondary" type="button" onClick={onRetry}>
              Retry
            </button>
          )}
          {onDismiss && (
            <button className="btn-ghost" type="button" onClick={onDismiss}>
              {dismissLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Alert;
