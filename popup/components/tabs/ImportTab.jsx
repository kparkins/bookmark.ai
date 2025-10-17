import { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";

function ImportTab() {
  const { loadEmbeddings, showStatus } = useAppContext();
  const [importingBookmarks, setImportingBookmarks] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

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

  // Listen for import progress updates (hybrid approach)
  useEffect(() => {
    // 1. Direct message listener for real-time updates
    const messageListener = (message) => {
      if (message.action === "processingProgress") {
        handleProgressUpdate(message.progress);
      }
    };

    // 2. Storage change listener as fallback
    const storageListener = (changes, areaName) => {
      if (areaName === "local" && changes.processingState) {
        handleProgressUpdate(changes.processingState.newValue);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);

    // 3. Check for existing import state on mount
    chrome.runtime.sendMessage({ action: "getImportProgress" }, (response) => {
      if (response?.success && response.progress) {
        handleProgressUpdate(response.progress);
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  // Handle progress updates
  const handleProgressUpdate = (progress) => {
    if (!progress) {
      return;
    }

    if (progress.activeTask !== "import") {
      setImportingBookmarks(false);
      setImportProgress(null);
      return;
    }

    setImportProgress(progress);
    setImportingBookmarks(Boolean(progress.isProcessing));

    if (progress.isProcessing) {
      const percentage =
        progress.total > 0
          ? Math.round((progress.processed / progress.total) * 100)
          : 0;

      // Show resume message if we picked up from a previous import
      const statusMessage = `Importing bookmarks... ${progress.processed}/${progress.total} (${percentage}%)`;
      showStatus(statusMessage, "loading");
    } else if (progress.processed > 0 || progress.imported > 0) {
      // Import completed or cancelled
      const message = progress.cancelled
        ? `Import cancelled. ${progress.imported} imported, ${progress.skipped} skipped, ${progress.failed} failed`
        : `Import complete! ${progress.imported} imported, ${progress.skipped} skipped, ${progress.failed} failed`;

      showStatus(message, progress.error ? "error" : "success");

      // Reload embeddings after successful import
      if (!progress.error && progress.imported > 0) {
        loadEmbeddings();
      }
    }
  };

  // Import all bookmarks
  const importBookmarks = async () => {
    if (
      !window.confirm(
        "This will import all your browser bookmarks and create embeddings for them. This may take a while if you have many bookmarks. Continue?",
      )
    ) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "startBatchImport",
        batchSize: 25,
      });

      if (response.success) {
        setImportingBookmarks(true);
        showStatus(
          `Starting import of ${response.total} bookmarks...`,
          "loading",
        );
      } else {
        showStatus(`Import failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    }
  };

  // Cancel import
  const cancelImport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "cancelImport",
      });

      if (response.success) {
        showStatus("Cancelling import...", "loading");
      }
    } catch (error) {
      console.error("Error cancelling import:", error);
    }
  };

  return (
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
          Import all your browser bookmarks and create embeddings for semantic
          search
        </p>

        {importingBookmarks && importProgress && (
          <div className="import-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="progress-text">
              {importProgress.processed} / {importProgress.total} bookmarks (
              {importProgress.imported} imported, {importProgress.skipped}{" "}
              skipped, {importProgress.failed} failed)
            </div>
          </div>
        )}

        <div className="bookmarks-buttons">
          <button
            className="btn-import-bookmarks"
            onClick={importBookmarks}
            disabled={importingBookmarks}
          >
            {importingBookmarks
              ? "⏳ Importing Bookmarks..."
              : "📚 Import All Bookmarks"}
          </button>

          {importingBookmarks && (
            <button className="btn-cancel-import" onClick={cancelImport}>
              ❌ Cancel Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportTab;
