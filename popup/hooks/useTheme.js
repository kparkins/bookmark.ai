import { useState, useEffect } from "react";

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme from chrome storage
  const loadTheme = async () => {
    try {
      const result = await chrome.storage.local.get(["darkMode"]);
      if (result.darkMode !== undefined) {
        setIsDarkMode(result.darkMode);
        applyTheme(result.darkMode);
      }
    } catch (error) {
      console.error("Error loading theme:", error);
    }
  };

  // Apply theme to document
  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  };

  // Toggle theme
  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    applyTheme(newMode);

    try {
      await chrome.storage.local.set({ darkMode: newMode });
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  // Load theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  return {
    isDarkMode,
    toggleTheme,
  };
}
