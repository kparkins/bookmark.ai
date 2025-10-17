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
