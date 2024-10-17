import { ensureKeepAlive, releaseKeepAlive } from "./keepAlive.js";

const PROCESSING_STORAGE_KEY = "processingState";

const defaultProcessingState = () => ({
  activeTask: null,
  isProcessing: false,
  total: 0,
  processed: 0,
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

function getStoredProcessingState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(PROCESSING_STORAGE_KEY, (result) => {
      resolve(result?.[PROCESSING_STORAGE_KEY] || null);
    });
  });
}

async function broadcastProcessingState() {
  const snapshot = { ...processingState };

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
  onComplete?.({ ...processingState });
  await releaseKeepAlive();
}

async function processNextBatch() {
  if (!processingJob) {
    return;
  }
  const { items, processItem, batchSize, delay, onComplete } = processingJob;
  if (processingState.cancelled || processingState.processed >= items.length) {
    await finishProcessing(onComplete);
    return;
  }

  const startIndex = processingState.processed;
  const endIndex = Math.min(startIndex + batchSize, items.length);

  for (let index = startIndex; index < endIndex; index++) {
    if (processingState.cancelled) {
      break;
    }

    const item = items[index];

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
  }

  if (processingState.cancelled || processingState.processed >= items.length) {
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

  const batchSize = options.batchSize || 1;
  const delay = options.delay ?? 0;
  const onComplete = options.onComplete;

  processingState = {
    ...defaultProcessingState(),
    activeTask: task,
    total: items.length,
    isProcessing: items.length > 0,
    startedAt: items.length > 0 ? Date.now() : null,
  };

  processingJob = {
    items,
    processItem,
    batchSize,
    delay,
    onComplete,
  };

  await ensureKeepAlive();
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
    return { ...processingState };
  }

  return {
    ...defaultProcessingState(),
    activeTask: task,
  };
}

export async function failProcessing(message) {
  processingState.error = message;
  processingState.isProcessing = false;
  processingState.cancelled = false;
  processingState.completedAt = Date.now();
  processingJob = null;
  await broadcastProcessingState();
  await releaseKeepAlive();
}

export async function initializeProcessingState() {
  const storedState = await getStoredProcessingState();

  if (storedState) {
    processingState = {
      ...defaultProcessingState(),
      ...storedState,
    };
  } else {
    processingState = defaultProcessingState();
  }

  processingJob = null;
  await broadcastProcessingState();
}
