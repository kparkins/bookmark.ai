import { useEffect, useMemo, useRef, useState } from "react";

const TASK_DESCRIPTORS = {
  import: {
    icon: "📥",
    label: "Importing Bookmarks",
    cancelLabel: "Cancel Import",
    running: (progress, percentage) =>
      `Importing bookmarks... ${progress.processed}/${progress.total} (${percentage}%)`,
    finished: (progress) => {
      const imported = progress.successCount || 0;
      const skipped = progress.skippedCount || 0;
      const failed = progress.failedCount || 0;
      return progress.cancelled
        ? `Import cancelled. ${imported} imported, ${skipped} skipped, ${failed} failed`
        : `Import complete! ${imported} imported, ${skipped} skipped, ${failed} failed`;
    },
    detail: (progress) => {
      const failed = progress.failedCount || 0;
      return `${progress.processed} / ${progress.total} bookmarks (${failed} failed)`;
    },
    cancelAction: "cancelImport",
    cancelMessage: "Cancelling import...",
    shouldReload: (progress) => (progress.successCount || 0) > 0,
  },
  regeneration: {
    icon: "🛠️",
    label: "Re-generating Embeddings",
    cancelLabel: "Cancel Regeneration",
    running: (progress, percentage) =>
      `Re-generating embeddings... ${progress.processed}/${progress.total} (${percentage}%)`,
    finished: (progress) => {
      const regenerated = progress.successCount || 0;
      const failed = progress.failedCount || 0;
      return progress.cancelled
        ? `Regeneration cancelled. ${regenerated} regenerated, ${failed} failed`
        : `Regeneration complete! ${regenerated} regenerated, ${failed} failed`;
    },
    detail: (progress) => {
      const regenerated = progress.successCount || 0;
      const failed = progress.failedCount || 0;
      return `${progress.processed} / ${progress.total} embeddings (${failed} failed)`;
    },
    cancelAction: "cancelRegeneration",
    cancelMessage: "Cancelling regeneration...",
    shouldReload: (progress) => (progress.successCount || 0) > 0,
  },
};

export function summarizeProgress(progress) {
  if (!progress?.activeTask) {
    return null;
  }

  const descriptor = TASK_DESCRIPTORS[progress.activeTask];
  if (!descriptor) {
    return null;
  }

  const percentage =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  if (progress.isProcessing) {
    return {
      text: descriptor.running(progress, percentage),
      type: "loading",
    };
  }

  return {
    text: descriptor.finished(progress),
    type: progress.error ? "error" : "success",
  };
}

export function useProcessing(loadEmbeddings, showStatus) {
  const [progress, setProgress] = useState(null);
  const lastStatusKey = useRef(null);
  const lastCompletion = useRef(null);
  const hasSeenInitialState = useRef(false);

  useEffect(() => {
    const handleProgressUpdate = (incoming) => {
      if (!incoming?.activeTask) {
        setProgress(null);
        return;
      }

      const descriptor = TASK_DESCRIPTORS[incoming.activeTask];
      const hasActivity =
        incoming.isProcessing ||
        incoming.processed > 0 ||
        incoming.error ||
        incoming.cancelled;

      if (!descriptor || !hasActivity) {
        setProgress(null);
        return;
      }

      setProgress(incoming);
    };

    const messageListener = (message) => {
      if (message?.action === "processingProgress") {
        handleProgressUpdate(message.progress);
      }
    };

    const storageListener = (changes, areaName) => {
      if (areaName === "local" && changes.processingState) {
        handleProgressUpdate(changes.processingState.newValue);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);

    // Load initial state from storage immediately
    chrome.storage.local.get("processingState", (result) => {
      if (result?.processingState) {
        handleProgressUpdate(result.processingState);
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  useEffect(() => {
    if (!progress) {
      return;
    }

    // On first load, just mark initial state as seen without showing notifications
    if (!hasSeenInitialState.current) {
      hasSeenInitialState.current = true;
      if (!progress.isProcessing && progress.completedAt) {
        // Store the completion timestamp so we don't show it again
        lastCompletion.current = progress.completedAt;
        const summary = summarizeProgress(progress);
        if (summary) {
          lastStatusKey.current = `${summary.type}:${summary.text}`;
        }
      }
      return;
    }

    const summary = summarizeProgress(progress);
    if (summary) {
      const key = `${summary.type}:${summary.text}`;
      if (summary.type === "loading") {
        lastStatusKey.current = key;
      } else if (lastStatusKey.current !== key) {
        lastStatusKey.current = key;
        showStatus(summary.text, summary.type);
      }
    }

    if (
      !progress.isProcessing &&
      !progress.error &&
      !progress.cancelled &&
      progress.completedAt &&
      lastCompletion.current !== progress.completedAt
    ) {
      const descriptor = TASK_DESCRIPTORS[progress.activeTask];
      if (descriptor?.shouldReload(progress)) {
        loadEmbeddings();
      }
      lastCompletion.current = progress.completedAt;
    }
  }, [progress, loadEmbeddings, showStatus]);

  const cancelProcessing = async (taskOverride) => {
    const task = taskOverride || progress?.activeTask;
    if (!task) {
      return;
    }

    const descriptor = TASK_DESCRIPTORS[task];
    if (!descriptor) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: descriptor.cancelAction,
      });

      if (response?.success) {
        showStatus(descriptor.cancelMessage, "loading");
      } else if (response?.error) {
        showStatus(response.error, "error");
      }
    } catch (error) {
      showStatus(`Unable to cancel ${task}: ${error.message}`, "error");
    }
  };

  const bannerDetails = useMemo(() => {
    if (!progress) {
      return null;
    }

    const descriptor = TASK_DESCRIPTORS[progress.activeTask];
    if (!descriptor) {
      return null;
    }

    const hasRemainingWork =
      progress.isProcessing ||
      (progress.total > 0 &&
        progress.processed < progress.total &&
        !progress.error &&
        !progress.cancelled);

    if (!hasRemainingWork) {
      return null;
    }

    const displayedProcessed = progress.processed;

    const percentage =
      progress.total > 0
        ? Math.round((displayedProcessed / progress.total) * 100)
        : 0;

    return {
      icon: descriptor.icon,
      label: descriptor.label,
      cancelLabel: descriptor.cancelLabel,
      percentage,
      detail: descriptor.detail({ ...progress, displayedProcessed }),
    };
  }, [progress]);

  return {
    progress,
    cancelProcessing,
    bannerDetails,
  };
}
