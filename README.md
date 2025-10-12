# Text Embedding Generator - React Chrome Extension

A Chrome extension that generates text embeddings **locally** using Transformers.js with a modern React UI.

**✨ Now following Chrome Extension best practices!**

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Load dist/ folder in Chrome
# Go to chrome://extensions/ → Enable Developer Mode → Load Unpacked → Select dist/
```

## ✨ Features

- 🧠 **Local AI Processing** - Runs entirely in your browser using Transformers.js
- 🔖 **Bookmark Import** - Import all browser bookmarks with one click
- 🔍 **Semantic Search** - Find similar embeddings by meaning (not just keywords!)
- ⚛️ **React UI** - Clean, modern interface built with React 18
- 💾 **Durable Storage** - IndexedDB ensures embeddings survive browser restarts
- 📦 **Backup & Restore** - Export/import your data as JSON files
- 🔒 **Privacy First** - No data leaves your browser
- ⚡ **Fast** - Built with Vite for optimal performance

## 📁 Project Structure (Chrome Best Practices)

```
bookmark.ai/
├── manifest.json           # Extension config (root level per Chrome standards)
├── popup/                  # Popup UI files
│   ├── popup.html
│   ├── Popup.jsx          # React component
│   └── Popup.css
├── background/            # Service worker
│   └── background.js      # Transformers.js integration
├── content/               # Content scripts  
│   └── content.js         # Text selection handler
├── lib/                   # Shared utilities
│   ├── db.js             # IndexedDB wrapper
│   └── storage.js
├── assets/               # Static assets
│   └── icons/            # Extension icons
├── dist/                  # Build output (load this in Chrome!)
└── docs/                  # Documentation
```

👉 See [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) for detailed documentation.

## 🎯 Usage

### Generate Embeddings

**Method 1: Popup Interface**
1. Click extension icon
2. Enter or paste text
3. Click "Generate & Store"

**Method 2: Context Menu**
1. Select text on any webpage
2. Right-click → "Generate Embedding"

### Import Bookmarks 🔖

Turn your entire bookmark collection into searchable embeddings!

1. Click "📚 Import All Bookmarks"
2. Confirm the action
3. Wait for processing (1-2 sec per bookmark)
4. Search your bookmarks by meaning!

**Example:** Search "web development" to find React docs, Vue guides, CSS tutorials, etc. - even if bookmark titles don't contain those words!

👉 See [docs/BOOKMARK-IMPORT.md](./docs/BOOKMARK-IMPORT.md) for detailed guide.

### Semantic Search 🔍

Search your embeddings by **meaning**, not just keywords!

1. Enter a search query (e.g., "machine learning")
2. Click 🔍 Search or press Enter
3. View results ranked by similarity (0-100%)
4. Find related content even with different words!

**Example:** Search "artificial intelligence" to find embeddings about ML, neural networks, AI models, etc.

👉 See [docs/SEMANTIC-SEARCH.md](./docs/SEMANTIC-SEARCH.md) for detailed guide and examples.

### Backup Your Data

**Export:** Click "Export Backup" to download all embeddings as JSON

**Import:** Click "Import Backup" to restore from a file

## 🛠️ Development

### Build Commands

```bash
npm run build        # Full production build
npm run dev          # Start dev server
npm run watch        # Watch mode for development
```

### Making Changes

**Edit React UI:**
- `popup/Popup.jsx` - Main React component

**Edit Extension Backend:**
- `background/background.js` - Embedding generation
- `lib/db.js` - Database operations

**Update Extension Config:**
- `manifest.json` - Extension settings

## 📂 Why This Structure?

This project follows **official Chrome Extension best practices**:

✅ `manifest.json` at root (Chrome requirement)  
✅ Functional folders: `popup/`, `background/`, `content/`  
✅ Shared code in `lib/`  
✅ Assets in `assets/`  
✅ Build output in `dist/`

**Benefits:**
- Standard convention - other developers will understand it immediately
- Clear separation of concerns
- Scalable architecture
- Matches Chrome's documentation examples

## 📚 Documentation

- [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) - Detailed folder structure & conventions
- [docs/BOOKMARK-IMPORT.md](./docs/BOOKMARK-IMPORT.md) - Import bookmarks guide
- [docs/SEMANTIC-SEARCH.md](./docs/SEMANTIC-SEARCH.md) - Semantic search guide with examples
- [docs/README-REACT.md](./docs/README-REACT.md) - React implementation guide
- [docs/QUICKSTART.md](./docs/QUICKSTART.md) - Getting started guide

## 🔧 Technical Details

- **Frontend:** React 18 + Vite
- **AI Model:** `Xenova/all-MiniLM-L6-v2` (384-dimensional embeddings)
- **Storage:** IndexedDB for persistence
- **Build Tool:** Vite 5
- **Bundle Size:** ~147KB (React + app code)

## 🔐 Privacy & Security

- All processing happens locally in your browser
- No external API calls
- No data collection or tracking
- Model is cached after first download (~23MB)
- Embeddings stored only in your browser's IndexedDB

## 💾 Data Persistence

**Survives:**
✅ Browser restart  
✅ Clearing cache  
✅ Clearing cookies  
✅ Clearing history

**Lost if:**
❌ User clears "Indexed databases and local storage"

**Solution:** Use Export Backup feature regularly!

## 🐛 Troubleshooting

**Extension won't load?**
- Ensure you selected the `dist/` folder, not the root
- Run `npm run build` first
- Enable Developer Mode in Chrome

**Changes not showing?**
- Rebuild: `npm run build`
- Reload extension: `chrome://extensions/` → click refresh icon

**Model not loading?**
- First generation downloads ~23MB model (one-time)
- Check browser console for errors
- Ensure internet connection for first download

**Embeddings disappeared?**
- Check if "Indexed databases" was cleared
- Restore from backup JSON if available

## 📄 License

MIT License - Free to use and modify

## 🙏 Credits

- Built with [Transformers.js](https://huggingface.co/docs/transformers.js) by Xenova
- Uses [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) model
- UI powered by [React](https://react.dev/)
- Bundled with [Vite](https://vitejs.dev/)

---

**Made with ⚛️ React + 🤖 Transformers.js + 🏗️ Chrome Extension Best Practices**
