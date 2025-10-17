import { createContext, useContext } from "react";
import { useEmbeddings } from "../hooks/useEmbeddings";
import { useProcessing } from "../hooks/useProcessing";
import { useSettings } from "../hooks/useSettings";
import { useStatus } from "../hooks/useStatus";
import { useTheme } from "../hooks/useTheme";

// Create the context
const AppContext = createContext(null);

// Provider component
export function AppProvider({ children }) {
  const embeddings = useEmbeddings();
  const settings = useSettings();
  const status = useStatus();
  const theme = useTheme();
  const processing = useProcessing(
    embeddings.loadEmbeddings,
    status.showStatus,
  );

  const resolvedSearchResultsLimit = (() => {
    const parsed = parseInt(settings.searchResultsLimit, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  const value = {
    // Embeddings
    embeddings: embeddings.embeddings,
    loadEmbeddings: embeddings.loadEmbeddings,
    deleteEmbedding: embeddings.deleteEmbedding,
    clearAllEmbeddings: embeddings.clearAllEmbeddings,

    // Settings
    selectedModel: settings.selectedModel,
    setSelectedModel: settings.setSelectedModel,
    customModel: settings.customModel,
    setCustomModel: settings.setCustomModel,
    searchResultsLimit: settings.searchResultsLimit,
    setSearchResultsLimit: settings.setSearchResultsLimit,
    resolvedSearchResultsLimit,
    loadSettings: settings.loadSettings,

    // Status
    status: status.status,
    showStatus: status.showStatus,
    clearStatus: status.clearStatus,

    // Processing
    processingProgress: processing.progress,
    cancelProcessing: processing.cancelProcessing,
    processingBanner: processing.bannerDetails,

    // Theme
    isDarkMode: theme.isDarkMode,
    toggleTheme: theme.toggleTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
