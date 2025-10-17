import { useEffect, useMemo, useRef, useState } from "react";

const TASK_DESCRIPTORS = {
  import: {
    icon: "📥",
    running: (progress, percentage) =>
      `Importing bookmarks... ${progress.processed}/${progress.total} (${percentage}%)`,
    finished: (progress) => {
      const imported = progress.imported || 0;
      const skipped = progress.skipped || 0;
      const failed = progress.failed || 0;
      return progress.cancelled
        ? `Import cancelled. ${imported} imported, ${skipped} skipped, ${failed} failed`
        : `Import complete! ${imported} imported, ${skipped} skipped, ${failed} failed`;
    },
    detail: (progress) => {
      const imported = progress.imported || 0;
      const skipped = progress.skipped || 0;
      const failed = progress.failed || 0;
      return `${progress.processed} / ${progress.total} bookmarks (${imported} imported, ${skipped} skipped, ${failed} failed)`;
    },
    cancelAction: "cancelImport",
    cancelMessage: "Cancelling import...",
    shouldReload: (progress) => (progress.imported || 0) > 0,
  },
  regeneration: {
    icon: "🛠️",
    running: (progress, percentage) =>
      `Re-generating embeddings... ${progress.processed}/${progress.total} (${percentage}%)`,
    finished: (progress) => {
      const regenerated = progress.regenerated || 0;
      const failed = progress.failed || 0;
      return progress.cancelled
        ? `Regeneration cancelled. ${regenerated} regenerated, ${failed} failed`
        : `Regeneration complete! ${regenerated} regenerated, ${failed} failed`;
    },
    detail: (progress) => {
      const regenerated = progress.regenerated || 0;
      const failed = progress.failed || 0;
      return `${progress.processed} / ${progress.total} embeddings (${regenerated} regenerated, ${failed} failed)`;
    },
    cancelAction: "cancelRegeneration",
    cancelMessage: "Cancelling regeneration...",
    shouldReload: (progress) => (progress.regenerated || 0) > 0,
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

    chrome.runtime.sendMessage({ action: "getImportProgress" }, (response) => {
      if (response?.success) {
        handleProgressUpdate(response.progress);
      }
    });

    chrome.runtime.sendMessage(
      { action: "getRegenerationProgress" },
      (response) => {
        if (response?.success) {
          handleProgressUpdate(response.progress);
        }
      },
    );

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  useEffect(() => {
    if (!progress) {
      return;
    }

    const summary = summarizeProgress(progress);
    if (summary) {
      const key = `${summary.type}:${summary.text}`;
      if (lastStatusKey.current !== key) {
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
    if (!progress?.isProcessing) {
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

    return {
      icon: descriptor.icon,
      percentage,
      detail: descriptor.detail(progress),
    };
  }, [progress]);

  return {
    progress,
    cancelProcessing,
    bannerDetails,
  };
}
