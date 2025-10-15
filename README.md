# Text Embedding Generator - React Chrome Extension

A Chrome extension that generates text embeddings **locally** using Transformers.js with a modern React UI.

**✨ Now following Chrome Extension best practices!**

## 🚀 Quick Start (From .crx file)

1. Download `bookmark.ai.crx`
3. Rename the file to bookmark.ai.zip
4. Unzip the file to an empty folder.
5. Go to chrome://extensions/ → Enable Developer Mode → Load Unpacked → Select the folder where the files were unzipped.

## 🚀 Quick Start (From Source)

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
- 🔖 **Automatic Bookmark Sync** - New bookmarks are automatically indexed in real-time
- 🔍 **Semantic Search** - Find similar embeddings by meaning (not just keywords!)
- 📚 **Library Management** - View, browse, and delete all stored embeddings
- 🎨 **Modern Tab Interface** - Clean UI with Search, Library, Import, and Settings tabs
- 🤖 **Multiple AI Models** - Choose from various embedding models with different dimensions
- 🔄 **Model Switching** - Regenerate all embeddings when switching models
- 💾 **Durable Storage** - IndexedDB ensures embeddings survive browser restarts
- 📦 **Backup & Restore** - Export/import your data as JSON files
- 🔒 **Privacy First** - No data leaves your browser
- ⚡ **Fast** - Built with Vite for optimal performance
- ⚛️ **React Architecture** - Component-based UI with hooks, context, and modern patterns

## 📁 Project Structure (Chrome Best Practices)

```
bookmark.ai/
├── manifest.json           # Extension config (root level per Chrome standards)
├── popup/                  # Popup UI files
│   ├── popup.html         # Popup HTML entry point
│   ├── popup-main.jsx     # React entry point
│   ├── Popup.jsx          # Main React component with tab routing
│   ├── Popup.css          # Global styles
│   ├── components/        # React components
│   │   ├── tabs/         # Tab components
│   │   │   ├── SearchTab.jsx      # Semantic search interface
│   │   │   ├── LibraryTab.jsx     # View all stored embeddings
│   │   │   ├── ImportTab.jsx      # Import/export functionality
│   │   │   └── SettingsTab.jsx    # Model selection & settings
│   │   └── ui/           # Reusable UI components
│   │       ├── TabBar.jsx         # Tab navigation
│   │       └── StatusMessage.jsx  # Status notifications
│   ├── context/          # React Context
│   │   └── AppContext.jsx         # Global state management
│   └── hooks/            # Custom React hooks
│       ├── useEmbeddings.js       # Embeddings state
│       ├── useSettings.js         # Settings management
│       ├── useStatus.js           # Status messages
│       └── useTheme.js            # Theme management
├── background/            # Service worker
│   └── background.js      # Transformers.js integration & bookmark sync
├── lib/                   # Shared utilities
│   └── db.js             # IndexedDB wrapper
├── assets/               # Static assets
│   └── icons/            # Extension icons
├── dist/                  # Build output (load this in Chrome!)
└── docs/                  # Documentation
```

👉 See [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) for detailed documentation.

## 🎯 Usage

The extension features a modern tabbed interface with four main sections:

### 🔍 Search Tab

Search your embeddings by **meaning**, not just keywords!

1. Enter a search query (e.g., "machine learning")
2. Click 🔍 Search or press Enter
3. View results ranked by similarity (0-100%)
4. Click on bookmark results to open them in a new tab

**Example:** Search "artificial intelligence" to find bookmarks about ML, neural networks, AI models, etc. - even if bookmark titles don't contain those exact words!

👉 See [docs/SEMANTIC-SEARCH.md](./docs/SEMANTIC-SEARCH.md) for detailed guide and examples.

### 📚 Library Tab

Browse and manage all your stored embeddings:

1. View all embeddings with their text content
2. See metadata: model used, vector dimensions, type (bookmark/text)
3. Click bookmark URLs to open them
4. Delete individual embeddings with the 🗑️ button
5. Use "Clear All" to delete all embeddings at once

### 📥 Import Tab

Manage your embedding data:

**Import Bookmarks:**
1. Click "📚 Import All Bookmarks"
2. Confirm the action
3. Wait for processing (1-2 sec per bookmark)
4. All bookmarks become searchable!

**Note:** New bookmarks are automatically indexed in real-time, so you typically only need to import once.

**Backup & Restore:**
- **Export:** Click "Export Backup" to download all embeddings as JSON
- **Import:** Click "Import Backup" to restore from a file

👉 See [docs/BOOKMARK-IMPORT.md](./docs/BOOKMARK-IMPORT.md) for detailed guide.

### ⚙️ Settings Tab

Configure your embedding model:

1. Choose from multiple embedding models (different sizes and dimensions)
2. View model details: dimensions and approximate size
3. Click "Regenerate All Embeddings" to reprocess with the new model

**Available Models:**
- Xenova/all-MiniLM-L6-v2 (384d) - Default, fast and balanced
- Xenova/paraphrase-multilingual-MiniLM-L12-v2 (384d) - Multilingual support
- And more...

### Context Menu (Optional)

You can also generate embeddings from selected text:

1. Select text on any webpage
2. Right-click → "Generate Embedding"
3. Text is automatically embedded and stored

## 🛠️ Development

### Build Commands

```bash
npm run build        # Full production build
npm run dev          # Start dev server
npm run watch        # Watch mode for development
```

### Making Changes

**Edit React UI:**
- `popup/Popup.jsx` - Main app component with tab routing
- `popup/components/tabs/` - Individual tab components (Search, Library, Import, Settings)
- `popup/components/ui/` - Reusable UI components (TabBar, StatusMessage)
- `popup/context/AppContext.jsx` - Global state management
- `popup/hooks/` - Custom React hooks for state management
- `popup/Popup.css` - Global styles

**Edit Extension Backend:**
- `background/background.js` - Embedding generation, model management, bookmark sync
- `lib/db.js` - IndexedDB operations

**Update Extension Config:**
- `manifest.json` - Extension settings and permissions

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
- **Architecture:** Component-based with React Context and custom hooks
- **State Management:** React Context API (AppContext)
- **AI Models:** Multiple options available
  - Default: `Xenova/all-MiniLM-L6-v2` (384-dimensional embeddings)
  - Multilingual: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384d)
  - And more configurable options
- **Storage:** IndexedDB for persistence
- **Build Tool:** Vite 5
- **Real-time Sync:** Automatic bookmark indexing via Chrome bookmarks API
- **Bundle Size:** Optimized with Vite

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
