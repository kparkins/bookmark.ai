import {
  startProcessing,
  cancelProcessing,
  getProcessingState,
  isProcessing,
  failProcessing,
} from "../processingService.js";
import { generateEmbedding, getAllBookmarks } from "../embeddingService.js";
import { embeddingStore } from "../../lib/embeddingStore.js";

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

export async function startBatchImport(batchSize = 25) {
  console.log("Starting batch bookmark import...");

  if (isProcessing()) {
    return {
      success: false,
      error: "Another task is currently running",
    };
  }

  let bookmarks = [];

  try {
    bookmarks = await getAllBookmarks();
    console.log(`Found ${bookmarks.length} bookmarks`);

    const existing = await embeddingStore.getAll();
    const existingUrls = new Set(
      existing.map((e) => e.metadata?.url).filter(Boolean),
    );

    const importableBookmarks = bookmarks.filter(
      (bookmark) => bookmark?.url && !existingUrls.has(bookmark.url),
    );

    await startProcessing(
      "import",
      importableBookmarks,
      createImportProcessor(existingUrls),
      {
        batchSize,
        delay: 100,
      },
    );

    return {
      success: true,
      message:
        importableBookmarks.length > 0
          ? "Import started"
          : "No new bookmarks to import",
      total: importableBookmarks.length,
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

export async function cancelImport() {
  const cancelled = await cancelProcessing("import");
  if (!cancelled) {
    return { success: false, error: "No import in progress" };
  }
  return { success: true, message: "Import cancellation requested" };
}

export function getImportProgress() {
  return {
    success: true,
    progress: getProcessingState("import"),
  };
}
