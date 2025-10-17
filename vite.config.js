import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // Background worker with Transformers.js is ~870 KB
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/popup.html"),
        background: resolve(__dirname, "background/background.js"),
      },
      output: {
        entryFileNames: "[name]/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".css")) {
            return "popup/[name].[ext]";
          }
          return "[name].[ext]";
        },
      },
      external: [
        // Externalize lib files so they're not bundled
        resolve(__dirname, "lib/settingsStore.js"),
        resolve(__dirname, "lib/embeddingStore.js"),
      ],
    },
    outDir: "dist",
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./popup"),
    },
  },
});
