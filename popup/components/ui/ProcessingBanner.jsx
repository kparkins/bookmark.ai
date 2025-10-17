import { useAppContext } from "../../context/AppContext";
import { summarizeProgress } from "../../hooks/useProcessing";

const TASK_TITLES = {
  import: "Importing Bookmarks",
  regeneration: "Re-generating Embeddings",
};

const TASK_CANCEL_LABELS = {
  import: "Cancel Import",
  regeneration: "Cancel Regeneration",
};

function ProcessingBanner() {
  const { processingProgress, processingBanner, cancelProcessing } =
    useAppContext();

  if (!processingProgress?.isProcessing || !processingBanner) {
    return null;
  }

  const { activeTask } = processingProgress;
  const { icon, percentage, detail } = processingBanner;
  const title = TASK_TITLES[activeTask] || "Processing";
  const cancelLabel = TASK_CANCEL_LABELS[activeTask] || "Cancel";
  const summary = summarizeProgress(processingProgress);

  return (
    <div className="processing-banner">
      <div className="processing-banner-header">
        <div className="processing-banner-title">
          <span className="processing-banner-icon" aria-hidden="true">
            {icon}
          </span>
          <div className="processing-banner-text">
            <span className="processing-banner-label">{title}</span>
            <span className="processing-banner-status">
              {summary?.text || title}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="processing-cancel"
          onClick={() => cancelProcessing(activeTask)}
        >
          {cancelLabel}
        </button>
      </div>
      <div className="progress-bar processing-progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="progress-text processing-progress-text">{detail}</div>
    </div>
  );
}

export default ProcessingBanner;
