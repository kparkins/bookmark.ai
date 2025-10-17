import { useState, useEffect } from "react";
import { settingsStore } from "../../lib/settingsStore.js";

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme from IndexedDB
  const loadTheme = async () => {
    try {
      const darkMode = await settingsStore.get("darkMode");
      if (darkMode !== null) {
        setIsDarkMode(darkMode);
        applyTheme(darkMode);
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
      await settingsStore.set("darkMode", newMode);
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
