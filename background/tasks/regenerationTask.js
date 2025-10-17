import {
  startProcessing,
  cancelProcessing,
  getProcessingState,
  isProcessing,
  failProcessing,
} from "../processingService.js";
import {
  initializeModel,
  generateEmbedding,
  composeEmbeddingInput,
} from "../embeddingService.js";
import { embeddingStore } from "../../lib/embeddingStore.js";

function createRegenerationProcessor() {
  return async (embedding) => {
    const combinedText =
      composeEmbeddingInput({
        title: embedding.metadata?.title,
        url: embedding.metadata?.url,
        summary: embedding.metadata?.summary,
        notes: embedding.metadata?.notes,
      }) || embedding.text;

    const preview = combinedText ? combinedText.substring(0, 50) : "embedding";

    const result = await generateEmbedding(combinedText);

    if (!result.success) {
      console.error(`Failed to regenerate embedding: ${preview}...`);
      return { status: "failure", error: result.error };
    }

    await embeddingStore.update(embedding.id, {
      text: combinedText,
      embedding: result.embedding,
      dimensions: result.dimensions,
      model: result.model,
      timestamp: Date.now(),
    });

    console.log(`Regenerated: ${preview}...`);
    return { status: "success" };
  };
}

export async function startEmbeddingsRegeneration(batchSize = 1) {
  console.log("Starting embeddings regeneration...");

  if (isProcessing()) {
    return {
      success: false,
      error: "Another task is currently running",
    };
  }

  let embeddingsToProcess = [];

  try {
    await initializeModel(true);

    embeddingsToProcess = await embeddingStore.getAll();
    console.log(`Found ${embeddingsToProcess.length} embeddings to regenerate`);

    await startProcessing(
      "regeneration",
      embeddingsToProcess,
      createRegenerationProcessor(),
      {
        batchSize,
        delay: 100,
      },
    );
  } catch (error) {
    console.error("Error starting embeddings regeneration:", error);
    await failProcessing(error.message);
    return {
      success: false,
      error: error.message,
    };
  }
  return {
    success: true,
    message:
      embeddingsToProcess.length > 0
        ? "Regeneration started"
        : "No embeddings to regenerate",
    total: embeddingsToProcess.length,
  };
}

export async function cancelRegeneration() {
  const cancelled = await cancelProcessing("regeneration");
  if (!cancelled) {
    return { success: false, error: "No regeneration in progress" };
  }
  return { success: true, message: "Regeneration cancellation requested" };
}

export function getRegenerationProgress() {
  return {
    success: true,
    progress: getProcessingState("regeneration"),
  };
}
