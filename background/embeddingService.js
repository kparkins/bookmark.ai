import { pipeline, env } from "@huggingface/transformers";
import { embeddingStore } from "../lib/embeddingStore.js";
import { settingsStore } from "../lib/settingsStore.js";

// Configure transformers.js to run locally
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Use single thread for stability

let embeddingPipeline = null;
let currentModel = "Xenova/all-MiniLM-L6-v2"; // Default model

export function composeEmbeddingInput({ title, url, summary, notes }) {
  const segments = [];

  if (title) {
    segments.push(`Title: ${title}`);
  }

  if (url) {
    segments.push(`URL: ${url}`);
  }

  if (summary) {
    segments.push(`Summary: ${summary}`);
  }

  if (notes) {
    segments.push(`Notes: ${notes}`);
  }

  if (segments.length === 0) {
    return "";
  }

  return segments.join("\n\n");
}

export async function getSelectedModel() {
  let model;
  try {
    model = await settingsStore.get("embeddingModel");
  } catch (error) {
    console.error("Error getting selected model:", error);
  }
  return model || "Xenova/all-MiniLM-L6-v2";
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
    if (!nodes) {
      return;
    }

    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
        });
      }

      if (node.children?.length) {
        traverse(node.children);
      }
    }
  }

  traverse(bookmarkTreeNodes);
  return bookmarks;
}

export async function processBookmark(bookmark, bookmarkId, options = {}) {
  try {
    const title = bookmark.title || "";
    const url = bookmark.url || "";
    const summary = options.summary ?? null;
    const notes = options.notes ?? "";

    const combinedText = composeEmbeddingInput({
      title,
      url,
      summary,
      notes,
    });

    const fallbackText = `${title} - ${url}`.trim() || bookmarkId;
    const textForEmbedding = combinedText || fallbackText;

    const result = await generateEmbedding(textForEmbedding);

    if (!result.success) {
      console.error(`Failed to generate embedding for: ${bookmark.title}`);
      return { success: false, error: result.error };
    }
    await embeddingStore.add({
      text: textForEmbedding,
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
        summary: summary,
        notes: notes,
      },
    });
  } catch (error) {
    console.error(`Error processing bookmark ${bookmark.title}:`, error);
    return { success: false, error: error.message };
  }
  console.log(`Embedding created for bookmark: ${bookmark.title}`);
  return { success: true };
}

export async function updateEmbeddingNote(embeddingId, note) {
  try {
    const embedding = await embeddingStore.get(embeddingId);

    if (!embedding) {
      return { success: false, error: "Embedding not found" };
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";

    const combinedText =
      composeEmbeddingInput({
        title: embedding.metadata?.title,
        url: embedding.metadata?.url,
        summary: embedding.metadata?.summary,
        notes: normalizedNote,
      }) || embedding.text;

    const result = await generateEmbedding(combinedText);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const updated = await embeddingStore.update(embeddingId, {
      text: combinedText,
      embedding: result.embedding,
      dimensions: result.dimensions,
      model: result.model,
      timestamp: Date.now(),
      metadata: {
        ...(embedding.metadata || {}),
        notes: normalizedNote,
      },
    });

    return { success: true, embedding: updated };
  } catch (error) {
    console.error("Error updating embedding note:", error);
    return { success: false, error: error.message };
  }
}
