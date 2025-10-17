import { useAppContext } from "../../context/AppContext";
import { summarizeProgress } from "../../hooks/useProcessing";

function ProcessingBanner() {
  const { processingProgress, processingBanner, cancelProcessing } =
    useAppContext();

  if (!processingProgress || !processingBanner) {
    return null;
  }

  const hasRemainingWork =
    processingProgress.isProcessing ||
    (processingProgress.total > 0 &&
      processingProgress.processed < processingProgress.total &&
      !processingProgress.error &&
      !processingProgress.cancelled);

  if (!hasRemainingWork) {
    return null;
  }

  const { activeTask } = processingProgress;
  const { icon, percentage, detail, label, cancelLabel } = processingBanner;
  const summary = summarizeProgress(processingProgress);
  const statusText = summary?.text || label;

  return (
    <div className="processing-strip" role="status">
      <div className="processing-strip-main">
        <div className="processing-strip-info">
          <span className="processing-strip-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="processing-strip-text">{statusText}</span>
          <span className="processing-strip-detail">{detail}</span>
        </div>
        <button
          type="button"
          className="processing-strip-cancel"
          onClick={() => cancelProcessing(activeTask)}
        >
          {cancelLabel}
        </button>
      </div>

      <div
        className="processing-strip-track"
        aria-label={label}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="processing-strip-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProcessingBanner;
