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

  // Load embeddings on mount
  useEffect(() => {
    loadEmbeddings();
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
                    {/* {result.metadata?.url && (
                      <div className="result-url">{result.metadata.url}</div>
                    )}*/}
                    <button
                      className="btn-delete-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEmbedding(result.id);
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
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
                        <span className="result-type">🧠 Embedding</span>
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
    </main>
  );
}

export default Popup;
