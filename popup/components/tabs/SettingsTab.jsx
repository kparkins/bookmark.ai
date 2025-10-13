import { useState } from "react";
import { useAppContext } from "../../context/AppContext";

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

function SettingsTab() {
  const {
    selectedModel,
    setSelectedModel,
    customModel,
    setCustomModel,
    embeddings,
    loadEmbeddings,
    showStatus,
    isDarkMode,
    toggleTheme,
  } = useAppContext();

  const [savingSettings, setSavingSettings] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerationProgress, setRegenerationProgress] = useState(null);

  // Save settings
  const saveSettings = async () => {
    setSavingSettings(true);
    showStatus("Saving settings...", "loading");

    try {
      const modelToSave =
        selectedModel === "custom" ? customModel : selectedModel;

      if (!modelToSave || modelToSave.trim() === "") {
        showStatus("Please select or enter a valid model", "error");
        setSavingSettings(false);
        return;
      }

      // Save to chrome storage
      await chrome.storage.local.set({ embeddingModel: modelToSave });

      // Notify background script to reload model
      const response = await chrome.runtime.sendMessage({
        action: "changeModel",
        model: modelToSave,
      });

      if (response && response.success) {
        showStatus("Settings saved! Model will reload on next use.", "success");
      } else {
        showStatus("Settings saved!", "success");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showStatus(`Error saving settings: ${error.message}`, "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Re-generate all embeddings with the current model
  const regenerateAllEmbeddings = async () => {
    if (
      !window.confirm(
        "This will re-generate all existing embeddings with the currently selected model. This may take a while. Continue?",
      )
    ) {
      return;
    }

    setRegenerating(true);
    setRegenerationProgress({ current: 0, total: 0 });
    showStatus("Re-generating embeddings...", "loading");

    try {
      // First, save the model settings
      const modelToSave =
        selectedModel === "custom" ? customModel : selectedModel;

      if (!modelToSave || modelToSave.trim() === "") {
        showStatus("Please select or enter a valid model", "error");
        setRegenerating(false);
        return;
      }

      await chrome.storage.local.set({ embeddingModel: modelToSave });

      // Notify background script to change model
      await chrome.runtime.sendMessage({
        action: "changeModel",
        model: modelToSave,
      });

      // Request regeneration
      const response = await chrome.runtime.sendMessage({
        action: "regenerateAllEmbeddings",
      });

      if (response.success) {
        showStatus(
          `Successfully regenerated ${response.regenerated} embeddings! ${response.failed > 0 ? `(${response.failed} failed)` : ""}`,
          "success",
        );
        await loadEmbeddings();
      } else {
        showStatus(`Regeneration failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error regenerating embeddings:", error);
      showStatus(`Regeneration failed: ${error.message}`, "error");
    } finally {
      setRegenerating(false);
      setRegenerationProgress(null);
    }
  };

  return (
    <div className="tab-content">
      <div className="settings-section">
        <div className="theme-toggle-section">
          <div className="theme-toggle-header">
            <span className="theme-toggle-label">
              {isDarkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}
            </span>
            <label className="theme-toggle-switch">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={toggleTheme}
              />
              <span className="theme-slider"></span>
            </label>
          </div>
        </div>

        <h3>⚙️ Model Settings</h3>
        <p className="settings-description">
          Choose which embedding model to use. Different models have different
          quality and speed tradeoffs.
        </p>

        <div className="model-selection">
          {availableModels.map((model) => (
            <div key={model.id} className="model-option">
              <label className="model-label">
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                />
                <div className="model-info">
                  <div className="model-name">{model.name}</div>
                  <div className="model-description">{model.description}</div>
                </div>
              </label>
            </div>
          ))}
        </div>

        {selectedModel === "custom" && (
          <div className="custom-model-input">
            <label htmlFor="customModel">Custom Model ID:</label>
            <input
              id="customModel"
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g., Xenova/paraphrase-multilingual-MiniLM-L12-v2"
            />
            <small>
              Enter a Hugging Face model ID that's compatible with
              Transformers.js
            </small>
          </div>
        )}

        <div className="settings-buttons">
          <button
            className="btn-settings"
            onClick={saveSettings}
            disabled={savingSettings || regenerating}
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
          <button
            className="btn-regenerate"
            onClick={regenerateAllEmbeddings}
            disabled={regenerating || savingSettings || embeddings.length === 0}
          >
            {regenerating ? "Re-generating..." : "Re-generate All Embeddings"}
          </button>
        </div>

        {regenerating && regenerationProgress && (
          <div className="regeneration-progress">
            <div className="progress-text">Processing embeddings...</div>
          </div>
        )}

        <div className="settings-note">
          <strong>Note:</strong> After changing the model, click "Re-generate
          All Embeddings" to update existing embeddings with the new model. This
          will preserve all your bookmarks and text embeddings.
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;
