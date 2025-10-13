import { useState, useEffect } from "react";

export function useEmbeddings(autoImport = false) {
  const [embeddings, setEmbeddings] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Load embeddings on mount
  useEffect(() => {
    loadEmbeddings();
  }, []);

  return {
    embeddings,
    loading,
    loadEmbeddings,
    deleteEmbedding,
    clearAllEmbeddings,
  };
}
