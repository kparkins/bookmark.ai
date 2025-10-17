import { useAppContext } from "../../context/AppContext";

function LibraryTab() {
  const { embeddings, deleteEmbedding, clearAllEmbeddings, showStatus } =
    useAppContext();
  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Truncate URL for display
  const truncateUrl = (url) => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      return (
        urlObj.hostname +
        (path.length > 30 ? path.substring(0, 30) + "..." : path)
      );
    } catch {
      return url.length > 50 ? url.substring(0, 50) + "..." : url;
    }
  };

  // // Format model name
  const formatModelName = (model) => {
    if (!model) return "Unknown";
    // Extract just the model name after the slash
    const parts = model.split("/");
    return parts.length > 1 ? parts[1] : model;
  };

  // Handle click on embedding result
  const handleResultClick = (embedding) => {
    if (embedding.metadata?.url) {
      chrome.tabs.create({ url: embedding.metadata.url });
    }
  };

  // Delete embedding
  const handleDeleteEmbedding = async (id) => {
    try {
      await chrome.runtime.sendMessage({ action: "deleteEmbedding", id });
      deleteEmbedding(id);
      showStatus("Embedding deleted", "success");
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error deleting embedding", "error");
    }
  };

  // Clear all embeddings
  const handleClearAllEmbeddings = async () => {
    if (!window.confirm("Are you sure you want to delete all embeddings?"))
      return;

    try {
      await chrome.runtime.sendMessage({ action: "clearAllEmbeddings" });
      clearAllEmbeddings();
      showStatus("All embeddings cleared", "success");
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error clearing embeddings", "error");
    }
  };

  return (
    <div className="tab-content">
      <div className="embeddings-section">
        <div className="embeddings-header">
          <div className="embeddings-header-left">
            <h2>Stored Embeddings</h2>
            <span className="embeddings-count">{embeddings.length}</span>
          </div>
          {embeddings.length > 0 && (
            <button
              className="btn-clear-all"
              onClick={handleClearAllEmbeddings}
            >
              Clear All
            </button>
          )}
        </div>

        <div className="embeddings-list">
          {embeddings.length === 0 ? (
            <div className="empty-state">No embeddings stored yet</div>
          ) : (
            embeddings.map((embedding) => (
              <div key={embedding.id} className="embedding-item">
                <div className="embedding-card-header">
                  {embedding.metadata?.url && (
                    <span className="embedding-badge badge-bookmark">
                      🔖 Bookmark
                    </span>
                  )}
                  {!embedding.metadata?.url && (
                    <span className="embedding-badge badge-text">�� Text</span>
                  )}
                </div>

                <div className="embedding-content">
                  <div className="embedding-text">
                    {truncateText(embedding.text)}
                  </div>
                </div>

                {embedding.metadata?.url && (
                  <div
                    className="embedding-url clickable"
                    title={embedding.metadata.url}
                    onClick={() => handleResultClick(embedding)}
                  >
                    🔗 {truncateUrl(embedding.metadata.url)}
                  </div>
                )}

                <div className="embedding-footer">
                  <div className="embedding-metadata">
                    <span
                      className="metadata-chip"
                      title={`Model: ${embedding.model}`}
                    >
                      🤖 {formatModelName(embedding.model)}
                    </span>
                    <span className="metadata-chip" title="Vector dimensions">
                      📊 {embedding.dimensions}d
                    </span>
                  </div>
                  <button
                    className="btn-delete-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEmbedding(embedding.id);
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default LibraryTab;
