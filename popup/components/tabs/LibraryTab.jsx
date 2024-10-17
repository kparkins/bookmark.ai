import { useState } from "react";
import { useAppContext } from "../../context/AppContext";

function LibraryTab() {
  const {
    embeddings,
    deleteEmbedding,
    clearAllEmbeddings,
    showStatus,
    updateEmbedding,
  } = useAppContext();
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNotes, setSavingNotes] = useState({});
  const [editingNotes, setEditingNotes] = useState({});
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [highlightedItems, setHighlightedItems] = useState({});

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

  const getDraftNote = (embedding) => {
    const draft = noteDrafts[embedding.id];
    if (draft !== undefined) {
      return draft;
    }
    return embedding.metadata?.notes || "";
  };

  const isNoteDirty = (embedding) => {
    return (
      (getDraftNote(embedding) || "").trim() !==
      (embedding.metadata?.notes || "").trim()
    );
  };

  const isSummaryExpanded = (id) => Boolean(expandedSummaries[id]);

  const toggleSummaryExpansion = (id) => {
    setExpandedSummaries((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleNoteChange = (id, value) => {
    setNoteDrafts((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const highlightItem = (id) => {
    setHighlightedItems((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setHighlightedItems((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 1000);
  };

  const beginEditingNotes = (embedding) => {
    setEditingNotes((prev) => ({ ...prev, [embedding.id]: true }));
    setNoteDrafts((prev) => ({
      ...prev,
      [embedding.id]: prev[embedding.id] ?? (embedding.metadata?.notes || ""),
    }));
  };

  const cancelEditingNotes = (embedding) => {
    setEditingNotes((prev) => {
      const next = { ...prev };
      delete next[embedding.id];
      return next;
    });
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[embedding.id];
      return next;
    });
  };

  const handleSaveNote = async (embedding) => {
    const draft = getDraftNote(embedding);
    const currentNote = embedding.metadata?.notes || "";
    const normalizedDraft = draft.trim();

    if (normalizedDraft === currentNote.trim()) {
      return;
    }

    setSavingNotes((prev) => ({ ...prev, [embedding.id]: true }));

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "updateEmbeddingNote",
            id: embedding.id,
            note: normalizedDraft,
          },
          (result) => {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(result);
          },
        );
      });

      if (!response?.success) {
        showStatus(response?.error || "Unable to update notes", "error");
        return;
      }

      if (response.embedding) {
        updateEmbedding(embedding.id, response.embedding);
        setNoteDrafts((prev) => {
          const next = { ...prev };
          delete next[embedding.id];
          return next;
        });
        setEditingNotes((prev) => {
          const next = { ...prev };
          delete next[embedding.id];
          return next;
        });
        highlightItem(embedding.id);
      }
    } catch (error) {
      console.error("Error updating notes:", error);
      showStatus(error?.message || "Error updating notes", "error");
    } finally {
      setSavingNotes((prev) => {
        const next = { ...prev };
        delete next[embedding.id];
        return next;
      });
    }
  };

  const handleDeleteNote = async (embedding) => {
    if (!window.confirm("Delete this note?")) {
      return;
    }

    setSavingNotes((prev) => ({ ...prev, [embedding.id]: true }));

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "updateEmbeddingNote",
            id: embedding.id,
            note: "",
          },
          (result) => {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(result);
          },
        );
      });

      if (!response?.success) {
        showStatus(response?.error || "Unable to delete note", "error");
        return;
      }

      if (response.embedding) {
        updateEmbedding(embedding.id, response.embedding);
        setNoteDrafts((prev) => {
          const next = { ...prev };
          delete next[embedding.id];
          return next;
        });
        setEditingNotes((prev) => {
          const next = { ...prev };
          delete next[embedding.id];
          return next;
        });
        highlightItem(embedding.id);
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      showStatus(error?.message || "Error deleting note", "error");
    } finally {
      setSavingNotes((prev) => {
        const next = { ...prev };
        delete next[embedding.id];
        return next;
      });
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
            embeddings.map((embedding) => {
              const isBookmark = Boolean(embedding.metadata?.url);
              const noteId = `notes-${embedding.id}`;
              const notePreview = (embedding.metadata?.notes || "").trim();
              const isEditing = Boolean(editingNotes[embedding.id]);
              const draftNote = getDraftNote(embedding);
              const hasSummary = Boolean(
                embedding.metadata?.summary &&
                  embedding.metadata.summary.trim(),
              );

              return (
                <div
                  key={embedding.id}
                  className={`embedding-item ${highlightedItems[embedding.id] ? "embedding-item-highlight" : ""}`}
                >
                  <div className="embedding-item-header">
                    <div className="embedding-item-title">
                      <span
                        className={`embedding-type ${
                          isBookmark ? "bookmark" : "text"
                        }`}
                        aria-hidden="true"
                      >
                        {isBookmark ? "🔖" : "📝"}
                      </span>
                      <span className="embedding-title">
                        {embedding.metadata?.title ||
                          truncateText(embedding.text, 80)}
                      </span>
                    </div>
                    {/* {isBookmark && (
                      <button
                        type="button"
                        className="btn-open-link"
                        onClick={() => handleResultClick(embedding)}
                      >
                        Open
                      </button>
                    )}*/}
                  </div>

                  {isBookmark && (
                    <div
                      className="embedding-url-line clickable"
                      title={embedding.metadata.url}
                      onClick={() => handleResultClick(embedding)}
                    >
                      {truncateUrl(embedding.metadata.url)}
                    </div>
                  )}

                  <div className="embedding-body">
                    {hasSummary && (
                      <div
                        className={`embedding-summary ${
                          isSummaryExpanded(embedding.id) ? "is-expanded" : ""
                        }`}
                      >
                        {isSummaryExpanded(embedding.id) && (
                          <div className="embedding-summary-text">
                            {embedding.metadata.summary}
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn-summary-toggle"
                          onClick={() => toggleSummaryExpansion(embedding.id)}
                        >
                          {isSummaryExpanded(embedding.id)
                            ? "Hide summary"
                            : "Show summary"}
                        </button>
                      </div>
                    )}

                    {!isBookmark && (
                      <div className="embedding-text-preview">
                        {truncateText(embedding.text, 200)}
                      </div>
                    )}

                    {!notePreview && !isEditing && (
                      <button
                        type="button"
                        className="btn-add-note-inline"
                        onClick={() => beginEditingNotes(embedding)}
                      >
                        + Add note
                      </button>
                    )}

                    {(isEditing || notePreview) && (
                      <div className="embedding-notes">
                        <div className="notes-header">
                          <span>Notes</span>
                          {!isEditing && (
                            <button
                              type="button"
                              className="btn-add-note"
                              onClick={() => beginEditingNotes(embedding)}
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <>
                            <textarea
                              id={noteId}
                              className="notes-textarea"
                              aria-label="Bookmark notes"
                              placeholder="Add personal context or reminders..."
                              value={draftNote}
                              onChange={(event) =>
                                handleNoteChange(
                                  embedding.id,
                                  event.target.value,
                                )
                              }
                              rows={3}
                            />
                            <div className="notes-actions">
                              <button
                                type="button"
                                className="btn-save-note"
                                onClick={() => handleSaveNote(embedding)}
                                disabled={
                                  savingNotes[embedding.id] ||
                                  !isNoteDirty(embedding)
                                }
                              >
                                {savingNotes[embedding.id]
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                className="btn-reset-note"
                                onClick={() => cancelEditingNotes(embedding)}
                                disabled={savingNotes[embedding.id]}
                              >
                                Cancel
                              </button>
                              {notePreview && (
                                <button
                                  type="button"
                                  className="btn-delete-note-text"
                                  onClick={() => handleDeleteNote(embedding)}
                                  disabled={savingNotes[embedding.id]}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="notes-preview">
                            {truncateText(notePreview, 220)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                      type="button"
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default LibraryTab;
