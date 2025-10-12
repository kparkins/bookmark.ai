# Project Structure - Chrome Extension Best Practices

This project follows **Chrome Web Extension best practices** for folder organization.

## 📁 Directory Overview

```
bookmark.ai/
├── manifest.json           # Extension configuration (root level)
│
├── popup/                  # Popup UI (React)
│   ├── popup.html         # HTML entry point
│   ├── popup-main.jsx     # React app entry
│   ├── Popup.jsx          # Main React component
│   └── Popup.css          # Component styles
│
├── background/            # Service worker
│   └── background.js      # Embedding generation with Transformers.js
│
├── content/               # Content scripts
│   └── content.js         # Runs on web pages for text selection
│
├── lib/                   # Shared utilities
│   ├── db.js             # IndexedDB storage wrapper
│   └── storage.js        # Legacy storage utilities
│
├── assets/               # Static assets
│   └── icons/           # Extension icons
│       ├── icon16.png
│       ├── icon48.png
│       ├── icon128.png
│       └── icon.svg
│
├── scripts/              # Build scripts
│   └── build.js         # Post-build file copy script
│
├── docs/                 # Documentation
│   ├── README-REACT.md  # React implementation guide
│   └── QUICKSTART.md    # Quick start guide
│
├── dist/                 # Build output (load this in Chrome!)
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── lib/
│   │   ├── db.js
│   │   └── storage.js
│   └── assets/
│       └── icons/
│
├── node_modules/         # Dependencies
├── vite.config.js       # Vite build configuration
├── package.json         # Project dependencies & scripts
└── .gitignore          # Git ignore rules
```

## 🎯 Why This Structure?

This follows the **official Chrome Extension best practices**:

### ✅ Benefits

1. **Standard Convention**: Matches Google's recommended structure
2. **Clear Separation**: Each folder has a specific purpose
3. **Easy Navigation**: Developers know where to find things
4. **Scalability**: Easy to add new features
5. **Maintainability**: Code is logically organized

### 📝 Chrome Extension Structure Guidelines

According to Chrome's documentation, extensions should be organized by **functionality**:

- `manifest.json` at root (required)
- `popup/` for popup UI files
- `background/` for service workers
- `content/` for content scripts
- `lib/` or `utils/` for shared code
- `assets/` for images, icons, etc.

## 🔍 Folder Purposes

### `popup/` - User Interface
Contains all UI-related files for the extension popup.

**What's inside:**
- `popup.html` - Entry point
- `Popup.jsx` - React component
- `popup-main.jsx` - Mounts React app
- `Popup.css` - Styles

**Why separate?**
- Keeps UI code isolated
- Easy to switch frameworks (React → Vue → Svelte)
- Clear boundary between UI and backend

### `background/` - Service Worker
Service workers run in the background and handle core extension logic.

**What's inside:**
- `background.js` - Transformers.js integration, embedding generation

**Why separate?**
- Service workers have special lifecycle
- Different execution context from popup
- Makes it clear what runs persistently

### `content/` - Content Scripts
Scripts that run in the context of web pages.

**What's inside:**
- `content.js` - Text selection handler

**Why separate?**
- Runs in different context (webpage)
- Has different permissions
- Clear security boundary

### `lib/` - Shared Utilities
Reusable code that multiple parts of the extension use.

**What's inside:**
- `db.js` - IndexedDB wrapper
- `storage.js` - Storage utilities

**Why separate?**
- Promotes code reuse
- Single source of truth
- Easy to test independently

### `assets/` - Static Assets
Images, icons, fonts, etc.

**What's inside:**
- `icons/` - Extension icons in various sizes

**Why separate?**
- Clear distinction between code and assets
- Easy to manage/replace assets
- Standard web development practice

## 🔨 Build Process

### Step 1: Vite Compiles React
```
popup/popup.html + Popup.jsx → dist/popup/popup.js
```

Vite bundles your React code and outputs to `dist/popup/`

### Step 2: Build Script Copies Files
```
background/background.js → dist/background/background.js
lib/db.js               → dist/lib/db.js
content/content.js      → dist/content/content.js
assets/icons/*          → dist/assets/icons/*
manifest.json           → dist/manifest.json
```

The build script copies non-bundled files to their proper locations.

### Step 3: Result
A complete extension in `dist/` that mirrors the source structure!

## 📊 Comparison: Before vs After

### ❌ Before (Mixed Structure)
```
bookmark.ai/
├── src/              (React stuff)
├── extension/        (Extension stuff)
├── public/           (Assets)
└── scripts/          (Build stuff)
```
**Problem:** Not clear what's extension-specific vs build tools

### ✅ After (Chrome Best Practices)
```
bookmark.ai/
├── popup/            (Popup UI - clear purpose)
├── background/       (Service worker - clear purpose)
├── content/          (Content scripts - clear purpose)
├── lib/              (Shared code - clear purpose)
└── assets/           (Static files - clear purpose)
```
**Benefit:** Immediately clear what each folder does in extension context

## 🎓 Chrome Extension Conventions

### Naming Conventions

**Folders:**
- Use plural for content that can grow: `scripts/`, `assets/`, `icons/`
- Use singular for specific purpose: `popup/`, `background/`, `content/`

**Files:**
- Background: `background.js` or `service-worker.js`
- Content: `content.js` or descriptive like `text-selector.js`
- Popup: `popup.html` + `popup.js`

### File Organization Tips

1. **One folder per extension component**
   ```
   popup/     → Everything for popup UI
   background/ → Everything for service worker
   ```

2. **Group related files together**
   ```
   popup/
   ├── popup.html
   ├── popup.js
   └── popup.css
   ```

3. **Shared code in lib/ or utils/**
   ```
   lib/
   ├── db.js
   ├── api.js
   └── helpers.js
   ```

## 🚀 Development Workflow

### Adding a New Popup Feature

1. Edit `popup/Popup.jsx`
2. Run `npm run build`
3. Reload extension in Chrome

### Adding Background Functionality

1. Edit `background/background.js`
2. Run `npm run build`
3. Reload extension in Chrome

### Adding a New Content Script

1. Create `content/my-feature.js`
2. Add to `manifest.json`:
   ```json
   "content_scripts": [{
     "js": ["content/my-feature.js"]
   }]
   ```
3. Update `scripts/build.js` to copy the file
4. Run `npm run build`

### Adding Shared Utilities

1. Create `lib/my-util.js`
2. Import from other files:
   ```javascript
   import { myUtil } from '../lib/my-util.js';
   ```
3. Update `scripts/build.js` to copy it
4. Run `npm run build`

## 📦 What Gets Deployed (dist/)

The `dist/` folder mirrors your source structure:

```
dist/
├── manifest.json              (copied)
├── popup/
│   ├── popup.html            (built by Vite)
│   ├── popup.js              (built by Vite)
│   └── popup.css             (built by Vite)
├── background/
│   └── background.js         (copied as-is)
├── content/
│   └── content.js            (copied as-is)
├── lib/
│   ├── db.js                 (copied as-is)
│   └── storage.js            (copied as-is)
└── assets/
    └── icons/                (copied as-is)
```

**This structure makes it easy for Chrome to load your extension!**

## 🔍 Finding Things

| What you need | Where to find it |
|---------------|------------------|
| React UI code | `popup/Popup.jsx` |
| Extension config | `manifest.json` |
| AI/Embedding logic | `background/background.js` |
| Database code | `lib/db.js` |
| Content script | `content/content.js` |
| Icons | `assets/icons/` |
| Build output | `dist/` |
| Documentation | `docs/` |

## 🌟 Best Practices Applied

✅ **Manifest at root** - Chrome requirement
✅ **Functional folders** - popup, background, content
✅ **Shared code in lib/** - Reusable utilities
✅ **Assets separate** - Icons, images in assets/
✅ **Build output in dist/** - Clean separation
✅ **Docs in docs/** - Easy to find documentation

## 📚 References

- [Chrome Extension Architecture](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)
- [Organize Extension Files](https://developer.chrome.com/docs/extensions/mv3/manifest/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

---

**This structure follows official Chrome Extension guidelines for professional, maintainable projects!**
