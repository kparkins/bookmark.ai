import { pipeline, env } from "@huggingface/transformers";
import { embeddingDB } from "../lib/db.js";

// Configure transformers.js to run locally
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Use single thread for stability

let embeddingPipeline = null;
let currentModel = "Xenova/all-MiniLM-L6-v2"; // Default model

// Get the selected model from storage
async function getSelectedModel() {
  try {
    const result = await chrome.storage.local.get(["embeddingModel"]);
    return result.embeddingModel || "Xenova/all-MiniLM-L6-v2";
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
      // Fallback to default model
      if (currentModel !== "Xenova/all-MiniLM-L6-v2") {
        console.log("Falling back to default model...");
        currentModel = "Xenova/all-MiniLM-L6-v2";
        embeddingPipeline = await pipeline("feature-extraction", currentModel);
      } else {
        throw error;
      }
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
    const id = await embeddingDB.add(embeddingData);
    const count = await embeddingDB.count();

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

// Message listener
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
      return true; // Keep channel open for async response

    case "getEmbeddings":
      embeddingDB
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
      embeddingDB
        .delete(request.id)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "clearAllEmbeddings":
      embeddingDB
        .clear()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "exportEmbeddings":
      embeddingDB
        .exportJSON()
        .then((json) => {
          sendResponse({ success: true, data: json });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "importEmbeddings":
      embeddingDB
        .importJSON(request.data)
        .then((count) => {
          sendResponse({ success: true, count: count });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "getStats":
      embeddingDB
        .getStats()
        .then((stats) => {
          sendResponse({ success: true, stats: stats });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true;

    case "searchEmbeddings":
      // Generate embedding for search query, then find similar ones
      generateEmbedding(request.query)
        .then((result) => {
          if (!result.success) {
            throw new Error(result.error);
          }
          // Search for similar embeddings
          return embeddingDB.search(result.embedding, request.topK || 5);
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
      // Force reload the model with the new selection
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
      regenerateAllEmbeddings()
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    default:
      // Unknown action
      console.warn(`Unknown action: ${request.action}`);
      return false;
  }
});

// Get all bookmarks recursively
async function getAllBookmarks() {
  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
        // It's a bookmark (not a folder)
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(bookmarkTreeNodes);
  return bookmarks;
}

// Re-generate all existing embeddings with the current model
async function regenerateAllEmbeddings() {
  try {
    console.log("Starting embeddings regeneration...");

    // Get all existing embeddings
    const existingEmbeddings = await embeddingDB.getAll();
    console.log(`Found ${existingEmbeddings.length} embeddings to regenerate`);

    if (existingEmbeddings.length === 0) {
      return {
        success: true,
        message: "No embeddings to regenerate",
        regenerated: 0,
        failed: 0,
      };
    }

    let regenerated = 0;
    let failed = 0;

    // Force reload the model to ensure we're using the latest selected model
    await initializeModel(true);

    // Process each embedding
    for (const embedding of existingEmbeddings) {
      try {
        // Generate new embedding with the current model
        const result = await generateEmbedding(embedding.text);

        if (result.success) {
          // Update the existing embedding with new vector
          await embeddingDB.update(embedding.id, {
            embedding: result.embedding,
            dimensions: result.dimensions,
            model: result.model,
            timestamp: Date.now(),
          });
          regenerated++;
          console.log(`Regenerated: ${embedding.text.substring(0, 50)}...`);
        } else {
          failed++;
          console.error(
            `Failed to regenerate embedding: ${embedding.text.substring(0, 50)}...`,
          );
        }

        // Small delay to prevent overwhelming the model
        if (regenerated % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        failed++;
        console.error(`Error regenerating embedding ${embedding.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Regeneration complete! ${regenerated} regenerated, ${failed} failed`,
      regenerated,
      failed,
      total: existingEmbeddings.length,
    };
  } catch (error) {
    console.error("Error regenerating embeddings:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Import state tracking
let importState = {
  isImporting: false,
  total: 0,
  processed: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  currentBookmarkIndex: 0,
  cancelled: false,
  error: null,
};

// Broadcast import progress to all listeners
async function broadcastImportProgress() {
  // Save to storage (triggers storage change listeners)
  await chrome.storage.local.set({ importState });

  // Also send direct message to any open popups
  try {
    chrome.runtime.sendMessage({
      action: "importProgress",
      progress: { ...importState },
    });
  } catch (error) {
    // Popup might not be open, that's okay
    console.log("No popup to receive message");
  }
}

// Load import state from storage
async function loadImportState() {
  try {
    const result = await chrome.storage.local.get(["importState"]);
    if (result.importState) {
      importState = { ...importState, ...result.importState };
    }
  } catch (error) {
    console.error("Error loading import state:", error);
  }
}

// Reset import state
async function resetImportState() {
  importState = {
    isImporting: false,
    total: 0,
    processed: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    currentBookmarkIndex: 0,
    cancelled: false,
    error: null,
  };
  await broadcastImportProgress();
}

// Process bookmarks in batches
async function processBatchImport(bookmarks, existingUrls, batchSize = 25) {
  // Check if we're already done or cancelled before processing
  if (
    importState.currentBookmarkIndex >= bookmarks.length ||
    importState.cancelled
  ) {
    importState.isImporting = false;
    await broadcastImportProgress();
    return;
  }

  const startIndex = importState.currentBookmarkIndex;
  const endIndex = Math.min(startIndex + batchSize, bookmarks.length);

  for (let i = startIndex; i < endIndex; i++) {
    // Check if import was cancelled
    if (importState.cancelled) {
      console.log("Import cancelled by user");
      break;
    }

    const bookmark = bookmarks[i];
    importState.currentBookmarkIndex = i + 1;
    importState.processed++;

    try {
      // Skip if we already have an embedding for this URL
      if (existingUrls.has(bookmark.url)) {
        importState.skipped++;
        continue;
      }

      // Create text from bookmark
      const text = `${bookmark.title} - ${bookmark.url}`;

      // Generate embedding
      const result = await generateEmbedding(text);

      if (!result.success) {
        importState.failed++;
        console.error(`Failed to generate embedding for: ${bookmark.title}`);
        continue;
      }
      // Store with metadata
      await embeddingDB.add({
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
      importState.imported++;
      console.log(`Imported: ${bookmark.title}`);
    } catch (error) {
      importState.failed++;
      console.error(`Error processing bookmark ${bookmark.title}:`, error);
    }
  }
  // Broadcast progress after each batch
  await broadcastImportProgress();

  // Continue with next batch
  setTimeout(() => processBatchImport(bookmarks, existingUrls, batchSize), 100);
}

// Start batch import
async function startBatchImport(batchSize = 25) {
  try {
    console.log("Starting batch bookmark import...");

    // Check if already importing
    if (importState.isImporting) {
      console.log("Import already in progress");
      return {
        success: false,
        error: "Import already in progress",
      };
    }

    // Get all bookmarks
    const bookmarks = await getAllBookmarks();
    console.log(`Found ${bookmarks.length} bookmarks`);

    if (bookmarks.length === 0) {
      return {
        success: true,
        message: "No bookmarks found",
        imported: 0,
        skipped: 0,
        failed: 0,
      };
    }

    importState = {
      isImporting: true,
      total: bookmarks.length,
      processed: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      currentBookmarkIndex: 0,
      cancelled: false,
      error: null,
    };
    // Get existing embeddings to avoid duplicates
    const existing = await embeddingDB.getAll();
    const existingUrls = new Set(
      existing.map((e) => e.metadata?.url).filter(Boolean),
    );
    // Start processing in batches (non-blocking)
    processBatchImport(bookmarks, existingUrls, batchSize);

    return {
      success: true,
      message: "Import started",
      total: bookmarks.length,
    };
  } catch (error) {
    console.error("Error starting batch import:", error);
    importState.isImporting = false;
    importState.error = error.message;
    await broadcastImportProgress();
    return {
      success: false,
      error: error.message,
    };
  }
}

// Cancel ongoing import
async function cancelImport() {
  if (importState.isImporting) {
    importState.cancelled = true;
    await broadcastImportProgress();
    return { success: true, message: "Import cancellation requested" };
  }
  return { success: false, error: "No import in progress" };
}

// Get current import progress
function getImportProgress() {
  return {
    success: true,
    progress: { ...importState },
  };
}

// Process a single bookmark and create embedding
async function processBookmark(bookmark, bookmarkId) {
  try {
    // Create text from bookmark
    const text = `${bookmark.title} - ${bookmark.url}`;

    // Generate embedding
    const result = await generateEmbedding(text);

    if (result.success) {
      // Store with metadata
      await embeddingDB.add({
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

// Listen for new bookmarks being created
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log("New bookmark detected:", bookmark);

  // Only process if it's a bookmark (has a URL), not a folder
  if (bookmark.url) {
    const result = await processBookmark(bookmark, id);

    if (result.success) {
      // Optional: Show a subtle notification
      try {
        await chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Bookmark Indexed",
          message: `"${bookmark.title}" has been indexed for search`,
          silent: true,
        });
      } catch (error) {
        // Notifications might not be available, that's okay
        console.log("Could not show notification:", error);
      }
    }
  }
});

// Listen for bookmark updates
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log("Bookmark updated:", id, changeInfo);

  try {
    // Get the full bookmark data
    const bookmarks = await chrome.bookmarks.get(id);
    const bookmark = bookmarks[0];

    if (bookmark.url) {
      // Find existing embedding for this bookmark
      const existing = await embeddingDB.getAll();
      const existingEmbedding = existing.find(
        (e) => e.metadata?.bookmarkId === id,
      );

      if (existingEmbedding) {
        // Update the existing embedding
        const text = `${bookmark.title} - ${bookmark.url}`;
        const result = await generateEmbedding(text);

        if (result.success) {
          await embeddingDB.update(existingEmbedding.id, {
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
        // No existing embedding, create one
        await processBookmark(bookmark, id);
      }
    }
  } catch (error) {
    console.error("Error updating bookmark embedding:", error);
  }
});

// Listen for bookmark deletions and clean up embeddings
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log("Bookmark removed:", id);

  try {
    // Find and delete the corresponding embedding
    const existing = await embeddingDB.getAll();
    const embeddingToDelete = existing.find(
      (e) => e.metadata?.bookmarkId === id,
    );

    if (embeddingToDelete) {
      await embeddingDB.delete(embeddingToDelete.id);
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
        // Notify user
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

// Load import state on initialization and resume if needed
loadImportState().then(async () => {
  console.log("Import state loaded:", importState);

  // If there was an import in progress that got interrupted, resume it
  if (importState.isImporting && !importState.cancelled) {
    console.log("Found interrupted import, resuming...");

    try {
      // Get all bookmarks
      const bookmarks = await getAllBookmarks();

      // Get existing embeddings to avoid duplicates
      const existing = await embeddingDB.getAll();
      const existingUrls = new Set(
        existing.map((e) => e.metadata?.url).filter(Boolean),
      );

      // Resume processing from where we left off
      console.log(
        `Resuming import from bookmark ${importState.currentBookmarkIndex} of ${importState.total}`,
      );
      processBatchImport(bookmarks, existingUrls, 25);
    } catch (error) {
      console.error("Error resuming import:", error);
      importState.isImporting = false;
      importState.error = `Resume failed: ${error.message}`;
      await broadcastImportProgress();
    }
  }
});

console.log("Background service worker initialized");
