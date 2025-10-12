import { useState, useEffect } from "react";
import "./Popup.css";

function Popup() {
  const [autoImport, setAutoImport] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [text, setText] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [embeddings, setEmbeddings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [importingBookmarks, setImportingBookmarks] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Xenova/all-MiniLM-L6-v2");
  const [customModel, setCustomModel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerationProgress, setRegenerationProgress] = useState(null);

  // Available embedding models
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

  // Show status message
  const showStatus = (message, type) => {
    setStatus({ message, type });

    if (type === "success") {
      setTimeout(() => {
        setStatus({ message: "", type: "" });
      }, 3000);
    }
  };

  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

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
      showStatus("Error loading embeddings", "error");
    }
  };

  // Generate embedding
  const generateEmbedding = async () => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      showStatus("Please enter some text", "error");
      return;
    }

    setLoading(true);
    showStatus(
      "Generating embedding... (this may take a moment on first run)",
      "loading",
    );

    try {
      const response = await chrome.runtime.sendMessage({
        action: "generateEmbedding",
        text: trimmedText,
        store: true,
      });

      if (response.success) {
        showStatus(
          `Embedding generated and stored! (${response.count} total)`,
          "success",
        );
        setText("");
        await loadEmbeddings();
      } else {
        showStatus(`Error: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showStatus(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Search embeddings by semantic similarity
  const searchEmbeddings = async () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      showStatus("Please enter a search query", "error");
      return;
    }

    if (embeddings.length === 0) {
      showStatus("No embeddings to search. Generate some first!", "error");
      return;
    }

    setSearching(true);
    showStatus("Searching...", "loading");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "searchEmbeddings",
        query: trimmedQuery,
        topK: 5,
      });

      if (response.success) {
        setSearchResults(response.results);
        showStatus(
          `Found ${response.results.length} similar embeddings`,
          "success",
        );
      } else {
        showStatus(`Search error: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error searching:", error);
      showStatus(`Search error: ${error.message}`, "error");
    } finally {
      setSearching(false);
    }
  };

  // Clear search results
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // Handle click on search result
  const handleResultClick = (result) => {
    // Check if this result has a URL in metadata
    if (result.metadata?.url) {
      chrome.tabs.create({ url: result.metadata.url });
    }
  };

  // Delete embedding
  const deleteEmbedding = async (id) => {
    try {
      await chrome.runtime.sendMessage({ action: "deleteEmbedding", id });
      await loadEmbeddings();
      // Clear search results if we deleted something from them
      if (searchResults) {
        setSearchResults(searchResults.filter((r) => r.id !== id));
      }
      showStatus("Embedding deleted", "success");
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error deleting embedding", "error");
    }
  };

  // Clear all embeddings
  const clearAllEmbeddings = async () => {
    if (!window.confirm("Are you sure you want to delete all embeddings?"))
      return;

    try {
      await chrome.runtime.sendMessage({ action: "clearAllEmbeddings" });
      await loadEmbeddings();
      showStatus("All embeddings cleared", "success");
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error clearing embeddings", "error");
    }
  };

  // Export embeddings
  const exportEmbeddings = async () => {
    try {
      showStatus("Exporting embeddings...", "loading");

      const response = await chrome.runtime.sendMessage({
        action: "exportEmbeddings",
      });

      if (response.success) {
        const blob = new Blob([response.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `embeddings-backup-${timestamp}.json`;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus("Embeddings exported successfully!", "success");
      } else {
        showStatus(`Export failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error exporting:", error);
      showStatus(`Export failed: ${error.message}`, "error");
    }
  };

  // Import embeddings
  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      showStatus("Importing embeddings...", "loading");

      const text = await file.text();
      const response = await chrome.runtime.sendMessage({
        action: "importEmbeddings",
        data: text,
      });

      if (response.success) {
        showStatus(
          `Successfully imported ${response.count} embeddings!`,
          "success",
        );
        await loadEmbeddings();
      } else {
        showStatus(`Import failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error importing:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };

  // Import all bookmarks
  const importBookmarks = async () => {
    if (
      !autoImport &&
      !window.confirm(
        "This will import all your browser bookmarks and create embeddings for them. This may take a while if you have many bookmarks. Continue?",
      )
    ) {
      return;
    }

    setImportingBookmarks(true);
    showStatus(
      "Importing bookmarks... This may take a few minutes.",
      "loading",
    );

    try {
      const response = await chrome.runtime.sendMessage({
        action: "importBookmarks",
      });

      if (response.success) {
        showStatus(response.message, "success");
        await loadEmbeddings();
      } else {
        showStatus(`Import failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    } finally {
      setImportingBookmarks(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateEmbedding();
    }
  };

  // Load settings
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
    }
  };

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

  // Load embeddings on mount
  useEffect(() => {
    loadEmbeddings();
    loadSettings();
    if (autoImport) {
      importBookmarks();
    }
  }, []);

  // Debounced search as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    if (embeddings.length === 0) {
      return;
    }

    // Debounce: wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      searchEmbeddings();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, embeddings.length]);

  return (
    <main>
      <div className="tabs">
        <button
          className={`tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          🔍 Search
        </button>
        <button
          className={`tab ${activeTab === "library" ? "active" : ""}`}
          onClick={() => setActiveTab("library")}
        >
          📚 Library
        </button>
        <button
          className={`tab ${activeTab === "import" ? "active" : ""}`}
          onClick={() => setActiveTab("import")}
        >
          📥 Import
        </button>
        <button
          className={`tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙ Settings
        </button>
      </div>
      {status.message && (
        <div className={`status ${status.type}`}>{status.message}</div>
      )}
      {activeTab === "generate" && (
        <div className="tab-content">
          <div className="input-section">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter text to generate embedding..."
            />
          </div>

          <div className="button-group">
            <button
              className="btn-primary"
              onClick={generateEmbedding}
              disabled={loading}
            >
              Generate & Store
            </button>
            <button className="btn-secondary" onClick={() => setText("")}>
              Clear
            </button>
          </div>
        </div>
      )}
      {activeTab === "search" && (
        <div className="tab-content">
          <div className="search-section">
            <h2>Search</h2>
            <div className="search-input-group">
              <input
                type="text"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by meaning (type to search)..."
              />
              {searchResults && (
                <button className="btn-clear-search" onClick={clearSearch}>
                  Clear
                </button>
              )}
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="search-results">
                <h3>Results (by similarity)</h3>
                {searchResults.map((result) => (
                  <div key={result.id} className="search-result-item">
                    <div className="result-header">
                      <span className="similarity-score">
                        {(result.similarity * 100).toFixed(1)}% match
                      </span>
                      {result.metadata?.url && (
                        <span className="result-type">🔖 Bookmark</span>
                      )}
                    </div>
                    <div
                      className={`embedding-text ${result.metadata?.url ? "clickable" : ""}`}
                      onClick={() => handleResultClick(result)}
                      style={result.metadata?.url ? { cursor: "pointer" } : {}}
                    >
                      {truncateText(result.text)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults && searchResults.length === 0 && (
              <div className="empty-state">No similar embeddings found</div>
            )}
          </div>
        </div>
      )}
      {activeTab === "library" && (
        <div className="tab-content">
          <div className="embeddings-section">
            <div className="embeddings-header">
              <h2>Stored Embeddings</h2>
              <span className="embeddings-count">{embeddings.length}</span>
            </div>

            <div className="embeddings-list">
              {embeddings.length === 0 ? (
                <div className="empty-state">No embeddings stored yet</div>
              ) : (
                embeddings.map((embedding) => (
                  <div key={embedding.id} className="embedding-item">
                    <div className="result-header">
                      {embedding.metadata?.url ? (
                        <div className="result-header">
                          <span>{embedding.model}</span>
                          <span>{embedding.dimensions}</span>
                          <span className="result-type">🧠 Embedding</span>
                        </div>
                      ) : (
                        <span className="result-type result-type-embedding">
                          🧠 Embedding
                        </span>
                      )}
                    </div>
                    <div
                      className={`embedding-text ${embedding.metadata?.url ? "clickable" : ""}`}
                      onClick={() => handleResultClick(embedding)}
                      style={
                        embedding.metadata?.url ? { cursor: "pointer" } : {}
                      }
                    >
                      {truncateText(embedding.text)}
                    </div>
                    <button
                      className="btn-delete-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEmbedding(embedding.id);
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            {embeddings.length > 0 && (
              <button className="btn-clear-all" onClick={clearAllEmbeddings}>
                Clear All Embeddings
              </button>
            )}
          </div>
        </div>
      )}
      {activeTab === "import" && (
        <div className="tab-content">
          <div className="backup-section">
            <h3>Backup & Restore</h3>
            <div className="backup-buttons">
              <button className="btn-backup" onClick={exportEmbeddings}>
                Export Backup
              </button>
              <button
                className="btn-restore"
                onClick={() => document.getElementById("fileInput").click()}
              >
                Import Backup
              </button>
            </div>
            <input
              id="fileInput"
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: "none" }}
            />
          </div>

          <div className="bookmarks-section">
            <h3>🔖 Import Bookmarks</h3>
            <p className="bookmarks-description">
              Import all your browser bookmarks and create embeddings for
              semantic search
            </p>
            <button
              className="btn-import-bookmarks"
              onClick={importBookmarks}
              disabled={importingBookmarks}
            >
              {importingBookmarks
                ? "⏳ Importing Bookmarks..."
                : "📚 Import All Bookmarks"}
            </button>
          </div>
        </div>
      )}
      {activeTab === "settings" && (
        <div className="tab-content">
          <div className="settings-section">
            <h3>⚙️ Model Settings</h3>
            <p className="settings-description">
              Choose which embedding model to use. Different models have
              different quality and speed tradeoffs.
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
                      <div className="model-description">
                        {model.description}
                      </div>
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
                disabled={
                  regenerating || savingSettings || embeddings.length === 0
                }
              >
                {regenerating
                  ? "Re-generating..."
                  : "Re-generate All Embeddings"}
              </button>
            </div>

            {regenerating && regenerationProgress && (
              <div className="regeneration-progress">
                <div className="progress-text">Processing embeddings...</div>
              </div>
            )}

            <div className="settings-note">
              <strong>Note:</strong> After changing the model, click
              "Re-generate All Embeddings" to update existing embeddings with
              the new model. This will preserve all your bookmarks and text
              embeddings.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Popup;
