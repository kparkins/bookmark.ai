import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/settingsStore.js";

const availableModels = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    name: "all-MiniLM-L6-v2",
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

  // Load settings from IndexedDB
  const loadSettings = async () => {
    try {
      const embeddingModel = await settingsStore.get("embeddingModel");
      if (embeddingModel) {
        if (availableModels.some((m) => m.id === embeddingModel)) {
          setSelectedModel(embeddingModel);
        } else {
          // It's a custom model
          setSelectedModel("custom");
          setCustomModel(embeddingModel);
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
