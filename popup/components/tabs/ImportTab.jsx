import { useAppContext } from "../../context/AppContext";

function ImportTab() {
  const {
    loadEmbeddings,
    showStatus,
    clearStatus,
    processingProgress,
    cancelProcessing,
  } = useAppContext();

  const isProcessing = Boolean(processingProgress?.isProcessing);
  const isImportActive =
    processingProgress?.activeTask === "import" &&
    processingProgress.isProcessing;

  const exportEmbeddings = async () => {
    try {
      clearStatus();
      const response = await chrome.runtime.sendMessage({
        action: "exportEmbeddings",
      });

      if (response.success) {
        const blob = new Blob([response.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `embeddings-backup-${timestamp}.json`;

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        showStatus("Embeddings exported successfully!", "success");
      } else {
        showStatus(`Export failed: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("Error exporting embeddings:", error);
      showStatus(`Export failed: ${error.message}`, "error");
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      clearStatus();
      const text = await file.text();
      const response = await chrome.runtime.sendMessage({
        action: "importEmbeddings",
        data: text,
      });

      if (response.success) {
        await loadEmbeddings();
        showStatus(
          `Successfully imported ${response.count} embeddings!`,
          "success",
        );
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error importing embeddings from file:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };

  const importBookmarks = async () => {
    if (
      !window.confirm(
        "This will import all your browser bookmarks and create embeddings for them. This may take a while if you have many bookmarks. Continue?",
      )
    ) {
      return;
    }

    try {
      clearStatus();
      const response = await chrome.runtime.sendMessage({
        action: "startBatchImport",
        batchSize: 1,
      });

      if (response.success) {
        if (response.total === 0) {
          await loadEmbeddings();
          showStatus("No new bookmarks found to import.", "success");
        }
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      showStatus(`Import failed: ${error.message}`, "error");
    }
  };

  const cancelImport = () => {
    clearStatus();
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
            className={`btn-import-bookmarks ${
              isImportActive ? "is-active" : ""
            }`}
            onClick={isImportActive ? cancelImport : importBookmarks}
            disabled={isProcessing && !isImportActive}
          >
            {isImportActive ? "❌ Cancel Import" : "📚 Import All Bookmarks"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportTab;
