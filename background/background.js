import { embeddingStore } from "../lib/embeddingStore.js";
import {
  initializeModel,
  generateEmbedding,
  storeEmbedding,
  processBookmark,
  getSelectedModel,
  composeEmbeddingInput,
  updateEmbeddingNote,
} from "./embeddingService.js";
import {
  startBatchImport,
  cancelImport,
  getImportProgress,
} from "./tasks/importTask.js";
import {
  startEmbeddingsRegeneration,
  cancelRegeneration,
  getRegenerationProgress,
} from "./tasks/regenerationTask.js";
import { initializeProcessingState } from "./processingService.js";
import { generateSummaryForUrl } from "./summarizationService.js";
import { ensureKeepAlive, releaseKeepAlive } from "./keepAlive.js";

let keepAlivePort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "offscreen-keepalive") {
    keepAlivePort = port;
    port.onDisconnect.addListener(() => {
      keepAlivePort = null;
    });
  }
});

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
          sendResponse({
            success: false,
            error: error.message,
          });
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
      ensureKeepAlive()
        .then(() => startBatchImport(request.batchSize || 1))
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
      getSelectedModel()
        .then((model) => {
          sendResponse({
            success: true,
            model,
          });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
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

    case "updateEmbeddingNote":
      updateEmbeddingNote(request.id, request.note)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "keepalive:ping":
      sendResponse({ success: true });
      return false;

    default:
      console.warn(`Unknown action: ${request.action}`);
      return false;
  }
});

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log("New bookmark detected:", bookmark);

  if (!bookmark.url) {
    return;
  }
  let summary = null;
  try {
    summary = await generateSummaryForUrl(bookmark.url);
  } catch (error) {
    console.warn(`Failed to generate summary for new bookmark: ${error}`);
  }

  const result = await processBookmark(bookmark, id, {
    summary,
    notes: "",
  });

  if (!result.success) {
    return;
  }
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
});

chrome.bookmarks.onChanged.addListener(async (id) => {
  console.log("Bookmark updated:", id);

  try {
    const bookmarks = await chrome.bookmarks.get(id);
    const bookmark = bookmarks[0];

    if (!bookmark.url) {
      return;
    }
    const existing = await embeddingStore.getAll();
    const existingEmbedding = existing.find(
      (e) => e.metadata?.bookmarkId === id,
    );

    if (!existingEmbedding) {
      let summary = null;
      try {
        summary = await generateSummaryForUrl(bookmark.url);
      } catch (error) {
        console.warn(
          `Failed to generate summary for updated bookmark: ${error}`,
        );
      }
      await processBookmark(bookmark, id, { summary, notes: "" });
      return;
    }

    let summary = existingEmbedding.metadata?.summary || null;
    try {
      const regeneratedSummary = await generateSummaryForUrl(bookmark.url);
      if (regeneratedSummary) {
        summary = regeneratedSummary;
      }
    } catch (error) {
      console.warn(
        `Summary refresh failed for updated bookmark ${bookmark.url}:`,
        error,
      );
    }

    const notes = existingEmbedding.metadata?.notes || "";

    const combinedText =
      composeEmbeddingInput({
        title: bookmark.title,
        url: bookmark.url,
        summary,
        notes,
      }) || `${bookmark.title} - ${bookmark.url}`;

    const result = await generateEmbedding(combinedText);

    if (!result.success) {
      return;
    }

    await embeddingStore.update(existingEmbedding.id, {
      text: combinedText,
      embedding: result.embedding,
      metadata: {
        ...existingEmbedding.metadata,
        title: bookmark.title,
        url: bookmark.url,
        summary,
        notes,
      },
    });
    console.log(`Embedding updated for: ${bookmark.title}`);
  } catch (error) {
    console.error("Error updating bookmark embedding:", error);
  }
});

chrome.bookmarks.onRemoved.addListener(async (id) => {
  console.log("Bookmark removed:", id);

  try {
    const existing = await embeddingStore.getAll();
    const embeddingToDelete = existing.find(
      (e) => e.metadata?.bookmarkId === id,
    );

    if (!embeddingToDelete) {
      return;
    }
    await embeddingStore.delete(embeddingToDelete.id);
    console.log(`Embedding deleted for bookmark: ${id}`);
  } catch (error) {
    console.error("Error deleting bookmark embedding:", error);
  }
});

initializeProcessingState();

console.log("Background service worker initialized");
