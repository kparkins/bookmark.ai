import { embeddingStore } from "../lib/embeddingStore.js";
import {
  initializeModel,
  generateEmbedding,
  storeEmbedding,
  processBookmark,
  getSelectedModel,
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

    default:
      console.warn(`Unknown action: ${request.action}`);
      return false;
  }
});

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

initializeProcessingState();

console.log("Background service worker initialized");
