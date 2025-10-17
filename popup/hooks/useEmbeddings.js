import { useState, useEffect, useRef } from "react";

export function useEmbeddings(autoImport = false) {
  const [embeddings, setEmbeddings] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastProcessedCount = useRef(0);

  // Load embeddings
  const loadEmbeddings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getEmbeddings",
      });

      if (response.success) {
        setEmbeddings(response.embeddings);
      }
    } catch (error) {
      console.error("Error loading embeddings:", error);
      throw error;
    }
  };

  // Delete embedding by id
  const deleteEmbedding = (id) => {
    setEmbeddings((prev) => prev.filter((e) => e.id !== id));
  };

  // Clear all embeddings
  const clearAllEmbeddings = () => {
    setEmbeddings([]);
  };

  const updateEmbedding = (id, update) => {
    setEmbeddings((prev) =>
      prev.map((embedding) => {
        if (embedding.id !== id) {
          return embedding;
        }

        const patch =
          typeof update === "function" ? update(embedding) : update || {};

        const nextMetadata = {
          ...(embedding.metadata || {}),
          ...(patch.metadata || {}),
        };

        const { metadata: _ignored, ...rest } = patch || {};

        return {
          ...embedding,
          ...rest,
          metadata: nextMetadata,
        };
      }),
    );
  };

  // Load embeddings on mount
  useEffect(() => {
    loadEmbeddings();
  }, []);

  // Listen for processing progress updates and reload when items are imported
  useEffect(() => {
    const handleProgressUpdate = (progress) => {
      if (!progress?.activeTask) {
        return;
      }

      // For import task, reload embeddings when new items are processed
      if (progress.activeTask === "import" && progress.isProcessing) {
        const currentProcessed = progress.processed || 0;
        const currentSuccessCount =
          progress.imported || progress.successCount || 0;

        // Reload if we've successfully imported at least one item and the count increased
        if (
          currentSuccessCount > lastProcessedCount.current &&
          currentSuccessCount > 0
        ) {
          lastProcessedCount.current = currentSuccessCount;
          loadEmbeddings();
        }
      }

      // Reset counter when import completes or is cancelled
      if (!progress.isProcessing && progress.activeTask === "import") {
        lastProcessedCount.current = 0;
      }
    };

    const messageListener = (message) => {
      if (message?.action === "processingProgress") {
        handleProgressUpdate(message.progress);
      }
    };

    const storageListener = (changes, areaName) => {
      if (areaName === "local" && changes.processingState) {
        handleProgressUpdate(changes.processingState.newValue);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  return {
    embeddings,
    loading,
    loadEmbeddings,
    deleteEmbedding,
    clearAllEmbeddings,
    updateEmbedding,
  };
}
