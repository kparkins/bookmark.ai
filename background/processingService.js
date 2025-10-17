const PROCESSING_STORAGE_KEY = "processingState";

const defaultProcessingState = () => ({
  activeTask: null,
  isProcessing: false,
  total: 0,
  processed: 0,
  currentIndex: 0,
  successCount: 0,
  skippedCount: 0,
  failedCount: 0,
  cancelled: false,
  error: null,
  startedAt: null,
  completedAt: null,
});

let processingState = defaultProcessingState();
let processingJob = null;

function withTaskAliases(state) {
  const snapshot = { ...state };

  if (snapshot.activeTask === "import") {
    snapshot.imported = snapshot.successCount;
    snapshot.skipped = snapshot.skippedCount;
    snapshot.failed = snapshot.failedCount;
  } else if (snapshot.activeTask === "regeneration") {
    snapshot.regenerated = snapshot.successCount;
    snapshot.failed = snapshot.failedCount;
  }

  return snapshot;
}

async function broadcastProcessingState() {
  const snapshot = withTaskAliases(processingState);

  try {
    await chrome.storage.local.set({ [PROCESSING_STORAGE_KEY]: snapshot });
  } catch (error) {
    console.error("Error persisting processing state:", error);
  }

  try {
    chrome.runtime.sendMessage({
      action: "processingProgress",
      progress: snapshot,
    });
  } catch (error) {
    console.log("No listener for processing progress:", error?.message);
  }
}

async function finishProcessing(onComplete) {
  processingState.isProcessing = false;
  processingState.completedAt = Date.now();
  await broadcastProcessingState();
  processingJob = null;
  onComplete?.({ ...withTaskAliases(processingState) });
}

async function processNextBatch() {
  if (!processingJob) {
    return;
  }
  const { items, processItem, batchSize, delay, onComplete } = processingJob;
  if (
    processingState.cancelled ||
    processingState.currentIndex >= items.length
  ) {
    await finishProcessing(onComplete);
    return;
  }

  const startIndex = processingState.currentIndex;
  const endIndex = Math.min(startIndex + batchSize, items.length);

  for (let index = startIndex; index < endIndex; index++) {
    if (processingState.cancelled) {
      break;
    }

    const item = items[index];
    processingState.currentIndex = index;

    try {
      const result = await processItem(item, index, { ...processingState });

      if (result?.status === "skip") {
        processingState.skippedCount++;
      } else if (result?.status === "failure") {
        processingState.failedCount++;
        if (result.error && !processingState.error) {
          processingState.error = result.error;
        }
      } else {
        processingState.successCount++;
      }
    } catch (error) {
      processingState.failedCount++;
      processingState.error = error?.message || "Unknown processing error";
      console.error("Error processing item:", error);
    }

    processingState.processed++;
    processingState.currentIndex = index + 1;
  }

  if (
    processingState.cancelled ||
    processingState.currentIndex >= items.length
  ) {
    await finishProcessing(onComplete);
    return;
  }

  await broadcastProcessingState();
  setTimeout(processNextBatch, delay);
}

export async function startProcessing(task, items, processItem, options = {}) {
  if (processingState.isProcessing) {
    throw new Error("Another task is already running");
  }

  const batchSize = options.batchSize || 25;
  const delay = options.delay ?? 100;
  const onComplete = options.onComplete;

  processingState = {
    ...defaultProcessingState(),
    activeTask: task,
    total: items.length,
    isProcessing: items.length > 0,
    startedAt: items.length > 0 ? Date.now() : null,
  };
  processingState.currentIndex = 0;

  processingJob = {
    items,
    processItem,
    batchSize,
    delay,
    onComplete,
  };

  await broadcastProcessingState();

  if (items.length === 0) {
    await finishProcessing(onComplete);
    return;
  }

  processNextBatch();
}

export async function cancelProcessing(task) {
  if (!processingState.isProcessing || processingState.cancelled) {
    return false;
  }

  if (task && processingState.activeTask !== task) {
    return false;
  }

  processingState.cancelled = true;
  await broadcastProcessingState();
  return true;
}

export function isProcessing(task) {
  if (!processingState.isProcessing) {
    return false;
  }
  if (!task) {
    return true;
  }
  return processingState.activeTask === task;
}

export function getProcessingState(task) {
  if (!task || processingState.activeTask === task) {
    return withTaskAliases(processingState);
  }

  return withTaskAliases({
    ...defaultProcessingState(),
    activeTask: task,
  });
}

export async function failProcessing(message) {
  processingState.error = message;
  processingState.isProcessing = false;
  processingState.cancelled = false;
  processingState.completedAt = Date.now();
  processingJob = null;
  await broadcastProcessingState();
}

export async function initializeProcessingState() {
  processingState = defaultProcessingState();
  processingJob = null;
  await broadcastProcessingState();
}
