import { pipeline, env } from "@huggingface/transformers";
import { embeddingStore } from "../lib/embeddingStore.js";
import { settingsStore } from "../lib/settingsStore.js";

// Configure transformers.js to run locally
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Use single thread for stability

let embeddingPipeline = null;
let currentModel = "Xenova/all-MiniLM-L6-v2"; // Default model

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

function resetProcessingState() {
  processingState = defaultProcessingState();
  processingJob = null;
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
    processingState.isProcessing = false;
    processingState.completedAt = Date.now();
    await broadcastProcessingState();
    processingJob = null;
    onComplete?.({ ...withTaskAliases(processingState) });
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
    processingState.isProcessing = false;
    processingState.completedAt = Date.now();
    await broadcastProcessingState();
    processingJob = null;
    onComplete?.({ ...withTaskAliases(processingState) });
    return;
  }

  await broadcastProcessingState();
  setTimeout(processNextBatch, delay);
}

async function startProcessing(task, items, processItem, options = {}) {
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
    processingState.isProcessing = false;
    processingState.completedAt = Date.now();
    await broadcastProcessingState();
    processingJob = null;
    onComplete?.({ ...withTaskAliases(processingState) });
    return;
  }

  processNextBatch();
}

async function cancelProcessing(task) {
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

function getProcessingState(task) {
  if (!task || processingState.activeTask === task) {
    return withTaskAliases(processingState);
  }

  return withTaskAliases({
    ...defaultProcessingState(),
    activeTask: task,
  });
}

async function failProcessing(message) {
  processingState.error = message;
  processingState.isProcessing = false;
  processingState.cancelled = false;
  processingState.completedAt = Date.now();
  processingJob = null;
  await broadcastProcessingState();
}

// Get the selected model from IndexedDB
async function getSelectedModel() {
  try {
    const model = await settingsStore.get("embeddingModel");
    return model || "Xenova/all-MiniLM-L6-v2";
  } catch (error) {
    console.error("Error getting selected model:", error);
    return "Xenova/all-MiniLM-L6-v2";
  }
}

// Initialize the embedding model
async function initializeModel(forceReload = false) {
  const selectedModel = await getSelectedModel();

  // If model changed, clear the existing pipeline
  if (selectedModel !== currentModel || forceReload) {
    console.log(`Model changed from ${currentModel} to ${selectedModel}`);
    embeddingPipeline = null;
    currentModel = selectedModel;
  }

  if (!embeddingPipeline) {
    console.log(`Loading embedding model: ${currentModel}...`);
    try {
      embeddingPipeline = await pipeline("feature-extraction", currentModel);
      console.log("Model loaded successfully");
    } catch (error) {
      console.error(`Error loading model ${currentModel}:`, error);
    }
  }
  return embeddingPipeline;
}

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    const pipe = await initializeModel();
    const output = await pipe(text, { pooling: "mean", normalize: true });

    // Convert tensor to array
    const embedding = Array.from(output.data);

    return {
      success: true,
      embedding: embedding,
      dimensions: embedding.length,
      model: await getSelectedModel(),
      text: text,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error generating embedding:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Store embedding in IndexedDB
async function storeEmbedding(embeddingData) {
  try {
    const id = await embeddingStore.add(embeddingData);
    const count = await embeddingStore.count();

    return {
      success: true,
      id: id,
      count: count,
    };
  } catch (error) {
    console.error("Error storing embedding:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getAllBookmarks() {
  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (!node.url) {
        continue;
      }
      bookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        dateAdded: node.dateAdded,
      });
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(bookmarkTreeNodes);
  return bookmarks;
}

function createImportProcessor(existingUrls) {
  return async (bookmark) => {
    if (!bookmark?.url) {
      return { status: "skip" };
    }

    if (existingUrls.has(bookmark.url)) {
      return { status: "skip" };
    }

    const text = `${bookmark.title} - ${bookmark.url}`;
    const result = await generateEmbedding(text);

    if (!result.success) {
      console.error(`Failed to generate embedding for: ${bookmark.title}`);
      return { status: "failure", error: result.error };
    }

    await embeddingStore.add({
      text: text,
      embedding: result.embedding,
      dimensions: result.dimensions,
      timestamp: result.timestamp,
      model: result.model,
      metadata: {
        type: "bookmark",
        url: bookmark.url,
        title: bookmark.title,
        dateAdded: bookmark.dateAdded,
      },
    });

    existingUrls.add(bookmark.url);
    console.log(`Imported: ${bookmark.title}`);
    return { status: "success" };
  };
}

function createRegenerationProcessor() {
  return async (embedding) => {
    const preview = embedding.text
      ? embedding.text.substring(0, 50)
      : "embedding";

    const result = await generateEmbedding(embedding.text);

    if (!result.success) {
      console.error(`Failed to regenerate embedding: ${preview}...`);
      return { status: "failure", error: result.error };
    }

    await embeddingStore.update(embedding.id, {
      embedding: result.embedding,
      dimensions: result.dimensions,
      model: result.model,
      timestamp: Date.now(),
    });

    console.log(`Regenerated: ${preview}...`);
    return { status: "success" };
  };
}

async function startBatchImport(batchSize = 25) {
  console.log("Starting batch bookmark import...");

  if (processingState.isProcessing) {
    return {
      success: false,
      error: "Another task is currently running",
    };
  }

  try {
    const bookmarks = await getAllBookmarks();
    console.log(`Found ${bookmarks.length} bookmarks`);

    const existing = await embeddingStore.getAll();
    const existingUrls = new Set(
      existing.map((e) => e.metadata?.url).filter(Boolean),
    );

    await startProcessing(
      "import",
      bookmarks,
      createImportProcessor(existingUrls),
      {
        batchSize,
        delay: 100,
        onComplete: (state) => {
          if (state.cancelled) {
            console.log(
              `Import cancelled. ${state.imported || 0} imported, ${state.skipped || 0} skipped, ${state.failed || 0} failed`,
            );
          } else {
            console.log(
              `Import complete! ${state.imported || 0} imported, ${state.skipped || 0} skipped, ${state.failed || 0} failed`,
            );
          }
        },
      },
    );

    if (bookmarks.length === 0) {
      return {
        success: true,
        message: "No bookmarks found",
        total: 0,
      };
    }

    return {
      success: true,
      message: "Import started",
      total: bookmarks.length,
    };
  } catch (error) {
    console.error("Error starting batch import:", error);
    await failProcessing(error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function startEmbeddingsRegeneration(batchSize = 25) {
  console.log("Starting embeddings regeneration...");

  if (processingState.isProcessing) {
    return {
      success: false,
      error: "Another task is currently running",
    };
  }

  try {
    await initializeModel(true);

    const existingEmbeddings = await embeddingStore.getAll();
    console.log(`Found ${existingEmbeddings.length} embeddings to regenerate`);

    await startProcessing(
      "regeneration",
      existingEmbeddings,
      createRegenerationProcessor(),
      {
        batchSize,
        delay: 100,
        onComplete: (state) => {
          if (state.cancelled) {
            console.log(
              `Regeneration cancelled. ${state.regenerated || 0} regenerated, ${state.failed || 0} failed`,
            );
          } else {
            console.log(
              `Regeneration complete! ${state.regenerated || 0} regenerated, ${state.failed || 0} failed`,
            );
          }
        },
      },
    );

    if (existingEmbeddings.length === 0) {
      return {
        success: true,
        message: "No embeddings to regenerate",
        total: 0,
      };
    }

    return {
      success: true,
      message: "Regeneration started",
      total: existingEmbeddings.length,
    };
  } catch (error) {
    console.error("Error starting embeddings regeneration:", error);
    await failProcessing(error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function cancelImport() {
  const cancelled = await cancelProcessing("import");
  if (!cancelled) {
    return { success: false, error: "No import in progress" };
  }
  return { success: true, message: "Import cancellation requested" };
}

async function cancelRegeneration() {
  const cancelled = await cancelProcessing("regeneration");
  if (!cancelled) {
    return { success: false, error: "No regeneration in progress" };
  }
  return { success: true, message: "Regeneration cancellation requested" };
}

function getImportProgress() {
  return {
    success: true,
    progress: getProcessingState("import"),
  };
}

function getRegenerationProgress() {
  return {
    success: true,
    progress: getProcessingState("regeneration"),
  };
}

// Process a single bookmark and create embedding
async function processBookmark(bookmark, bookmarkId) {
  try {
    const text = `${bookmark.title} - ${bookmark.url}`;
    const result = await generateEmbedding(text);

    if (result.success) {
      await embeddingStore.add({
        text: text,
        embedding: result.embedding,
        dimensions: result.dimensions,
        timestamp: result.timestamp,
        model: result.model,
        metadata: {
          type: "bookmark",
          url: bookmark.url,
          title: bookmark.title,
          bookmarkId: bookmarkId,
          dateAdded: bookmark.dateAdded || Date.now(),
        },
      });

      console.log(`Embedding created for bookmark: ${bookmark.title}`);
      return { success: true };
    } else {
      console.error(`Failed to generate embedding for: ${bookmark.title}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`Error processing bookmark ${bookmark.title}:`, error);
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "generateEmbedding":
      generateEmbedding(request.text)
        .then((result) => {
          if (result.success && request.store) {
            return storeEmbedding(result);
          }
          return result;
        })
        .then(sendResponse);
      return true;

    case "getEmbeddings":
      embeddingStore
        .getAllSorted()
        .then((embeddings) => {
          sendResponse({
            success: true,
            embeddings: embeddings,
          });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true;

    case "deleteEmbedding":
      embeddingStore
        .delete(request.id)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "clearAllEmbeddings":
      embeddingStore
        .clear()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "exportEmbeddings":
      embeddingStore
        .exportJSON()
        .then((json) => {
          sendResponse({ success: true, data: json });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "importEmbeddings":
      embeddingStore
        .importJSON(request.data)
        .then((count) => {
          sendResponse({ success: true, count: count });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "getStats":
      embeddingStore
        .getStats()
        .then((stats) => {
          sendResponse({ success: true, stats: stats });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "searchEmbeddings":
      generateEmbedding(request.query)
        .then((result) => {
          if (!result.success) {
            throw new Error(result.error);
          }
          return embeddingStore.search(result.embedding, request.topK || 5);
        })
        .then((results) => {
          sendResponse({ success: true, results: results });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "startBatchImport":
      startBatchImport(request.batchSize || 25)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "getImportProgress":
      sendResponse(getImportProgress());
      return true;

    case "cancelImport":
      cancelImport()
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "changeModel":
      initializeModel(true)
        .then(() => {
          sendResponse({
            success: true,
            message: `Model changed to ${request.model}`,
          });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true;

    case "getCurrentModel":
      sendResponse({
        success: true,
        model: currentModel,
      });
      return true;

    case "regenerateAllEmbeddings":
      startEmbeddingsRegeneration(request.batchSize || 25)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "getRegenerationProgress":
      sendResponse(getRegenerationProgress());
      return true;

    case "cancelRegeneration":
      cancelRegeneration()
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    default:
      console.warn(`Unknown action: ${request.action}`);
      return false;
  }
});

// Listen for new bookmarks being created
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log("New bookmark detected:", bookmark);

  if (bookmark.url) {
    const result = await processBookmark(bookmark, id);

    if (result.success) {
      try {
        await chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Bookmark Indexed",
          message: `"${bookmark.title}" has been indexed for search`,
          silent: true,
        });
      } catch (error) {
        console.log("Could not show notification:", error);
      }
    }
  }
});

// Listen for bookmark updates
chrome.bookmarks.onChanged.addListener(async (id) => {
  console.log("Bookmark updated:", id);

  try {
    const bookmarks = await chrome.bookmarks.get(id);
    const bookmark = bookmarks[0];

    if (bookmark.url) {
      const existing = await embeddingStore.getAll();
      const existingEmbedding = existing.find(
        (e) => e.metadata?.bookmarkId === id,
      );

      if (existingEmbedding) {
        const text = `${bookmark.title} - ${bookmark.url}`;
        const result = await generateEmbedding(text);

        if (result.success) {
          await embeddingStore.update(existingEmbedding.id, {
            text: text,
            embedding: result.embedding,
            metadata: {
              ...existingEmbedding.metadata,
              title: bookmark.title,
              url: bookmark.url,
            },
          });
          console.log(`Embedding updated for: ${bookmark.title}`);
        }
      } else {
        await processBookmark(bookmark, id);
      }
    }
  } catch (error) {
    console.error("Error updating bookmark embedding:", error);
  }
});

// Listen for bookmark deletions and clean up embeddings
chrome.bookmarks.onRemoved.addListener(async (id) => {
  console.log("Bookmark removed:", id);

  try {
    const existing = await embeddingStore.getAll();
    const embeddingToDelete = existing.find(
      (e) => e.metadata?.bookmarkId === id,
    );

    if (embeddingToDelete) {
      await embeddingStore.delete(embeddingToDelete.id);
      console.log(`Embedding deleted for bookmark: ${id}`);
    }
  } catch (error) {
    console.error("Error deleting bookmark embedding:", error);
  }
});

// Context menu for selected text
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "generateEmbedding",
    title: "Generate Embedding",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generateEmbedding" && info.selectionText) {
    generateEmbedding(info.selectionText)
      .then((result) => {
        if (result.success) {
          return storeEmbedding(result);
        }
        throw new Error(result.error);
      })
      .then(() => {
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "", tabId: tab.id });
        }, 2000);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }
});

async function initializeProcessingState() {
  resetProcessingState();
  await broadcastProcessingState();
}

initializeProcessingState();

console.log("Background service worker initialized");
