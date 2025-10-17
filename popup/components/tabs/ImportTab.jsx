import { useAppContext } from "../../context/AppContext";

function ImportTab() {
  const { loadEmbeddings, showStatus, processingProgress, cancelProcessing } =
    useAppContext();

  const isProcessing = Boolean(processingProgress?.isProcessing);
  const isImportActive =
    processingProgress?.activeTask === "import" &&
    processingProgress.isProcessing;

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
        if (response.total > 0) {
          showStatus(
            `Starting import of ${response.total} bookmarks...`,
            "loading",
          );
        } else {
          showStatus("No new bookmarks found to import.", "success");
          await loadEmbeddings();
        }
      } else {
        showStatus(`Import failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    }
  };

  // Cancel import
  const cancelImport = () => {
    cancelProcessing("import");
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

        <div className="bookmarks-buttons">
          <button
            className="btn-import-bookmarks"
            onClick={importBookmarks}
            disabled={isProcessing}
          >
            {isImportActive
              ? "⏳ Importing Bookmarks..."
              : "📚 Import All Bookmarks"}
          </button>

          {isImportActive && (
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
