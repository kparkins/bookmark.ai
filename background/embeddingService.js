import { pipeline, env } from "@huggingface/transformers";
import { embeddingStore } from "../lib/embeddingStore.js";
import { settingsStore } from "../lib/settingsStore.js";

// Configure transformers.js to run locally
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Use single thread for stability

let embeddingPipeline = null;
let currentModel = "Xenova/all-MiniLM-L6-v2"; // Default model

export async function getSelectedModel() {
  try {
    const model = await settingsStore.get("embeddingModel");
    return model || "Xenova/all-MiniLM-L6-v2";
  } catch (error) {
    console.error("Error getting selected model:", error);
    return "Xenova/all-MiniLM-L6-v2";
  }
}

export async function initializeModel(forceReload = false) {
  const selectedModel = await getSelectedModel();

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

export async function generateEmbedding(text) {
  try {
    const pipe = await initializeModel();
    const output = await pipe(text, { pooling: "mean", normalize: true });
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

export async function storeEmbedding(embeddingData) {
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

export async function getAllBookmarks() {
  const bookmarkTreeNodes = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
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

export async function processBookmark(bookmark, bookmarkId) {
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
