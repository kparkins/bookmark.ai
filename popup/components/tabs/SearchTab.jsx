import { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";

function SearchTab() {
  const { embeddings, showStatus, resolvedSearchResultsLimit } =
    useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const truncateUrl = (url) => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      return (
        urlObj.hostname +
        (path.length > 40 ? `${path.substring(0, 40)}...` : path)
      );
    } catch {
      return url.length > 60 ? `${url.substring(0, 60)}...` : url;
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

    try {
      const limit =
        resolvedSearchResultsLimit && resolvedSearchResultsLimit > 0
          ? resolvedSearchResultsLimit
          : Math.max(embeddings.length, 1);

      const response = await chrome.runtime.sendMessage({
        action: "searchEmbeddings",
        query: trimmedQuery,
        topK: limit,
      });

      if (response.success) {
        setSearchResults(response.results);
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
    if (result.metadata?.url) {
      chrome.tabs.create({ url: result.metadata.url });
    }
  };

  // Debounced search as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    if (embeddings.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      searchEmbeddings();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, embeddings.length]);

  return (
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
                <div className="search-result-body">
                  <div
                    className={`result-title ${result.metadata?.url ? "clickable" : ""}`}
                    onClick={() => handleResultClick(result)}
                    role={result.metadata?.url ? "button" : undefined}
                  >
                    {result.metadata?.title
                      ? truncateText(result.metadata.title, 120)
                      : truncateText(result.text, 120)}
                  </div>

                  {result.metadata?.notes && (
                    <div className="result-notes">
                      <strong>Notes:</strong>{" "}
                      {truncateText(result.metadata.notes, 180)}
                    </div>
                  )}
                </div>

                {result.metadata?.url && (
                  <div
                    className="result-url clickable"
                    onClick={() => handleResultClick(result)}
                  >
                    🔗 {truncateUrl(result.metadata.url)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {searchResults && searchResults.length === 0 && (
          <div className="empty-state">No similar embeddings found</div>
        )}
      </div>
    </div>
  );
}

export default SearchTab;
