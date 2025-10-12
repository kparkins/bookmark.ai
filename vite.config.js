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
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/popup.html"),
      },
      output: {
        entryFileNames: "popup/[name].js",
        chunkFileNames: "popup/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".css")) {
            return "popup/[name].[ext]";
          }
          return "[name].[ext]";
        },
      },
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
