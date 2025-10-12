import { pipeline, env } from "@huggingface/transformers";
import { embeddingDB } from "../lib/db.js";

// Configure transformers.js to run locally
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Use single thread for stability

let embeddingPipeline = null;

// Initialize the embedding model
async function initializeModel() {
  if (!embeddingPipeline) {
    console.log("Loading embedding model...");
    // Using a lightweight sentence transformer model
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
    console.log("Model loaded successfully");
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
  if (request.action === "generateEmbedding") {
    generateEmbedding(request.text)
      .then((result) => {
        if (result.success && request.store) {
          return storeEmbedding(result);
        }
        return result;
      })
      .then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === "getEmbeddings") {
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
  }

  if (request.action === "deleteEmbedding") {
    embeddingDB
      .delete(request.id)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "clearAllEmbeddings") {
    embeddingDB
      .clear()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "exportEmbeddings") {
    embeddingDB
      .exportJSON()
      .then((json) => {
        sendResponse({ success: true, data: json });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "importEmbeddings") {
    embeddingDB
      .importJSON(request.data)
      .then((count) => {
        sendResponse({ success: true, count: count });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "getStats") {
    embeddingDB
      .getStats()
      .then((stats) => {
        sendResponse({ success: true, stats: stats });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "searchEmbeddings") {
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
  }

  if (request.action === "importBookmarks") {
    importAllBookmarks()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
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

// Import all bookmarks and create embeddings
async function importAllBookmarks() {
  try {
    console.log("Starting bookmark import...");

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

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Get existing embeddings to avoid duplicates
    const existing = await embeddingDB.getAll();
    const existingUrls = new Set(
      existing.map((e) => e.metadata?.url).filter(Boolean),
    );

    // Process bookmarks in batches to avoid overwhelming the system
    for (const bookmark of bookmarks) {
      try {
        // Skip if we already have an embedding for this URL
        if (existingUrls.has(bookmark.url)) {
          skipped++;
          continue;
        }

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
            metadata: {
              type: "bookmark",
              url: bookmark.url,
              title: bookmark.title,
              dateAdded: bookmark.dateAdded,
            },
          });
          imported++;
          console.log(`Imported: ${bookmark.title}`);
        } else {
          failed++;
          console.error(`Failed to generate embedding for: ${bookmark.title}`);
        }

        // Small delay to prevent overwhelming the model
        if (imported % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        failed++;
        console.error(`Error processing bookmark ${bookmark.title}:`, error);
      }
    }

    return {
      success: true,
      message: `Import complete! ${imported} imported, ${skipped} skipped (already exist), ${failed} failed`,
      imported,
      skipped,
      failed,
      total: bookmarks.length,
    };
  } catch (error) {
    console.error("Error importing bookmarks:", error);
    return {
      success: false,
      error: error.message,
    };
  }
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

console.log("Background service worker initialized");
