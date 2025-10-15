import { copyFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("📦 Building Chrome Extension...\n");

// Ensure dist directory structure exists
const dirsToCreate = [
  "dist",
  "dist/popup",
  "dist/background",
  "dist/lib",
  "dist/assets",
  "dist/assets/icons",
];

dirsToCreate.forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Copy manifest to root of dist
try {
  copyFileSync("manifest.json", "dist/manifest.json");
  console.log("✅ Copied manifest.json → dist/manifest.json");
} catch (error) {
  console.error("❌ Failed to copy manifest:", error.message);
}

// Background worker is now bundled by Vite, so we don't copy it manually
// Vite will output it to dist/background/background.js

// Copy library files
const libFiles = [{ src: "lib/db.js", dest: "dist/lib/db.js" }];

libFiles.forEach(({ src, dest }) => {
  try {
    copyFileSync(src, dest);
    console.log(`✅ Copied ${src} → ${dest}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${src}:`, error.message);
  }
});

// Copy content scripts
const contentFiles = [];

contentFiles.forEach(({ src, dest }) => {
  try {
    copyFileSync(src, dest);
    console.log(`✅ Copied ${src} → ${dest}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${src}:`, error.message);
  }
});

// Copy icons
const iconFiles = [
  "assets/icons/icon16.png",
  "assets/icons/icon48.png",
  "assets/icons/icon128.png",
  "assets/icons/icon.svg",
  "assets/icons/create_icons.html",
  "assets/icons/README.txt",
];

iconFiles.forEach((file) => {
  try {
    if (existsSync(file)) {
      const dest = file.replace("assets/", "dist/assets/");
      copyFileSync(file, dest);
      console.log(`✅ Copied ${file} → ${dest}`);
    }
  } catch (error) {
    console.error(`❌ Failed to copy ${file}:`, error.message);
  }
});

// Vite builds popup files directly to dist/popup/
// Just need to ensure popup.html exists
if (existsSync("dist/popup.html")) {
  // Move to correct location if Vite put it in wrong place
  copyFileSync("dist/popup.html", "dist/popup/popup.html");
  console.log("✅ Moved popup.html → dist/popup/popup.html");
}

if (existsSync("dist/popup.js")) {
  copyFileSync("dist/popup.js", "dist/popup/popup.js");
  console.log("✅ Moved popup.js → dist/popup/popup.js");
}

if (existsSync("dist/popup.css")) {
  copyFileSync("dist/popup.css", "dist/popup/popup.css");
  console.log("✅ Moved popup.css → dist/popup/popup.css");
}

console.log("\n✨ Build complete! Extension files are in dist/");
console.log("📍 Load the dist/ folder as an unpacked extension in Chrome\n");
console.log("📂 Extension structure:");
console.log("   dist/");
console.log("   ├── manifest.json");
console.log("   ├── popup/           (UI files)");
console.log("   ├── background/      (service worker)");
console.log("   ├── content/         (content scripts)");
console.log("   ├── lib/             (shared utilities)");
console.log("   └── assets/          (icons, images)");
console.log();
