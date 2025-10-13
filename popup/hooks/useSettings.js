import { useState, useEffect } from "react";

const availableModels = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    name: "all-MiniLM-L6-v2 (Default)",
    description: "Fast, lightweight, 384 dimensions",
  },
  {
    id: "Xenova/all-mpnet-base-v2",
    name: "all-mpnet-base-v2",
    description: "Better quality, 768 dimensions",
  },
  {
    id: "Xenova/bge-small-en-v1.5",
    name: "BGE Small",
    description: "Optimized for retrieval, 384 dimensions",
  },
  {
    id: "Xenova/bge-base-en-v1.5",
    name: "BGE Base",
    description: "Better retrieval, 768 dimensions",
  },
  {
    id: "nomic-ai/nomic-embed-text-v1.5",
    name: "Nomic Embed v1.5",
    description: "High quality, 768 dimensions",
  },
  {
    id: "custom",
    name: "Custom Model",
    description: "Enter a custom Hugging Face model ID",
  },
];

export function useSettings() {
  const [selectedModel, setSelectedModel] = useState("Xenova/all-MiniLM-L6-v2");
  const [customModel, setCustomModel] = useState("");

  // Load settings from chrome storage
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(["embeddingModel"]);
      if (result.embeddingModel) {
        if (availableModels.some((m) => m.id === result.embeddingModel)) {
          setSelectedModel(result.embeddingModel);
        } else {
          // It's a custom model
          setSelectedModel("custom");
          setCustomModel(result.embeddingModel);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      throw error;
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  return {
    selectedModel,
    setSelectedModel,
    customModel,
    setCustomModel,
    loadSettings,
  };
}
