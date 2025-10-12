# Quick Start Guide - React Extension

## ✅ Your Extension is Built and Ready!

The `dist/` folder contains your complete Chrome extension powered by React.

## 🚀 Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`

2. Enable **"Developer mode"** (toggle in top right corner)

3. Click **"Load unpacked"**

4. Select the **`dist/`** folder from your project:
   ```
   /Users/kyle/Desktop/workspace/bookmark.ai/dist
   ```

5. Done! The extension should now appear in Chrome

## 📦 What's in dist/?

```
dist/
├── popup.html          # React app entry point
├── popup.js            # Compiled React code (~147KB)
├── popup.css           # Component styles
├── background.js       # Service worker for embeddings
├── db.js              # IndexedDB storage
├── content.js         # Content script
├── manifest.json      # Extension configuration
└── icons/             # Extension icons
```

## 🎯 Using the Extension

1. **Generate Embeddings:**
   - Click the extension icon in Chrome toolbar
   - Type or paste text
   - Click "Generate & Store"

2. **Context Menu:**
   - Select text on any webpage
   - Right-click → "Generate Embedding"

3. **Backup/Restore:**
   - Export: Download all embeddings as JSON
   - Import: Restore from a backup file

## 🛠️ Making Changes

### Rebuild After Editing React Code

```bash
npm run build
```

Then reload the extension:
- Go to `chrome://extensions/`
- Click the refresh icon on your extension

### Live Development (Optional)

For faster development with auto-reload:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Watch for changes
npm run watch
```

## 📝 Project Structure

**Source Files (edit these):**
- `src/Popup.jsx` - Main React component
- `src/Popup.css` - Styles
- `src/popup-main.jsx` - React entry point

**Backend Files (already work):**
- `background.js` - Service worker
- `db.js` - IndexedDB storage
- `content.js` - Content script

**Config Files:**
- `vite.config.js` - Build configuration
- `build.js` - Post-build script
- `manifest.json` - Extension manifest

## ❓ Troubleshooting

**Extension not loading?**
- Make sure you selected the `dist/` folder, not the root
- Check that `dist/manifest.json` exists

**Changes not showing?**
- Rebuild: `npm run build`
- Reload extension in Chrome: `chrome://extensions/` → refresh icon

**Model not loading?**
- First generation downloads ~23MB model (one-time)
- Check browser console for errors

**Embeddings disappeared?**
- Check if browser data was cleared
- Use Export Backup feature regularly!

## 🎉 You're All Set!

Your React-powered embedding extension is ready to use. Enjoy the clean, modern codebase!

### Next Steps

- Read `README-REACT.md` for detailed React info
- Check `README.md` for extension features
- Explore `src/Popup.jsx` to see the React code
