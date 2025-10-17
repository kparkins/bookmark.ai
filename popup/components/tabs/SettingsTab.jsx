import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { settingsStore } from "../../../lib/settingsStore.js";

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
    searchResultsLimit,
    setSearchResultsLimit,
    embeddings,
    showStatus,
    isDarkMode,
    toggleTheme,
    processingProgress,
    cancelProcessing,
  } = useAppContext();

  const [savingSettings, setSavingSettings] = useState(false);

  const isProcessing = Boolean(processingProgress?.isProcessing);
  const isRegenerating =
    processingProgress?.activeTask === "regeneration" &&
    processingProgress.isProcessing;

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

      await settingsStore.set("embeddingModel", modelToSave);

      const trimmedLimit = searchResultsLimit.trim();
      let normalizedLimit = null;

      if (trimmedLimit !== "") {
        const parsedLimit = parseInt(trimmedLimit, 10);

        if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
          showStatus(
            "Search result limit must be a positive number or left blank.",
            "error",
          );
          setSavingSettings(false);
          return;
        }

        normalizedLimit = parsedLimit;
      }

      if (normalizedLimit === null) {
        await settingsStore.delete("searchResultsLimit");
        setSearchResultsLimit("");
      } else {
        await settingsStore.set("searchResultsLimit", normalizedLimit);
        setSearchResultsLimit(String(normalizedLimit));
      }

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

  const regenerateAllEmbeddings = async () => {
    if (
      !window.confirm(
        "This will re-generate all existing embeddings with the currently selected model. This may take a while. Continue?",
      )
    ) {
      return;
    }

    showStatus("Preparing to re-generate embeddings...", "loading");

    try {
      const modelToSave =
        selectedModel === "custom" ? customModel : selectedModel;

      if (!modelToSave || modelToSave.trim() === "") {
        showStatus("Please select or enter a valid model", "error");
        return;
      }

      await settingsStore.set("embeddingModel", modelToSave);

      await chrome.runtime.sendMessage({
        action: "changeModel",
        model: modelToSave,
      });

      const response = await chrome.runtime.sendMessage({
        action: "regenerateAllEmbeddings",
      });

      if (!response.success) {
        if (response.error === "Regeneration already in progress") {
          showStatus("Regeneration already in progress", "loading");
        } else {
          showStatus(
            `Regeneration failed to start: ${response.error}`,
            "error",
          );
        }
        return;
      }

      if (response.total === 0) {
        showStatus("No embeddings found to regenerate.", "success");
      } else {
        showStatus(`Re-generating ${response.total} embeddings...`, "loading");
      }
    } catch (error) {
      console.error("Error regenerating embeddings:", error);
      showStatus(`Regeneration failed: ${error.message}`, "error");
    }
  };

  const cancelRegeneration = () => {
    cancelProcessing("regeneration");
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

        <div className="search-settings">
          <h3>🔍 Search Preferences</h3>
          <div className="search-limit-input">
            <label htmlFor="searchResultsLimit">Max Search Results</label>
            <input
              id="searchResultsLimit"
              type="number"
              min="1"
              placeholder="Leave blank for all results"
              value={searchResultsLimit}
              onChange={(e) => setSearchResultsLimit(e.target.value)}
            />
            <small>
              Limit how many matches appear for each search. Leave blank to
              return every result.
            </small>
          </div>
        </div>

        <div className="settings-buttons">
          <button
            className="btn-settings"
            onClick={saveSettings}
            disabled={savingSettings || isProcessing}
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
          <button
            className="btn-regenerate"
            onClick={regenerateAllEmbeddings}
            disabled={isProcessing || savingSettings || embeddings.length === 0}
          >
            {isRegenerating ? "Re-generating..." : "Re-generate All Embeddings"}
          </button>
        </div>

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
