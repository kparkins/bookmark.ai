import { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";

function SearchTab() {
  const { embeddings, showStatus } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Truncate text for display
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
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
  );
}

export default SearchTab;
