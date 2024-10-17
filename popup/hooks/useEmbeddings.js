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
    let isLoadingEmbeddings = false;

    const handleProgressUpdate = (progress) => {
      if (!progress?.activeTask) {
        return;
      }

      // For import task, reload embeddings when new items are processed
      if (progress.activeTask === "import" && progress.isProcessing) {
        const currentSuccessCount = progress.successCount || 0;

        // Reload if we've successfully imported at least one item and the count increased
        if (
          currentSuccessCount > lastProcessedCount.current &&
          currentSuccessCount > 0 &&
          !isLoadingEmbeddings
        ) {
          lastProcessedCount.current = currentSuccessCount;
          isLoadingEmbeddings = true;
          loadEmbeddings().finally(() => {
            isLoadingEmbeddings = false;
          });
        }
      }

      // Reset counter when import completes or is cancelled
      if (!progress.isProcessing && progress.activeTask === "import") {
        lastProcessedCount.current = 0;
      }
    };

    // Only listen to storage changes to avoid duplicate updates
    // (processingService broadcasts to both storage and messages)
    const storageListener = (changes, areaName) => {
      if (areaName === "local" && changes.processingState) {
        handleProgressUpdate(changes.processingState.newValue);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
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
