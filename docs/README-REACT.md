# Text Embedding Generator - React Version

This is the **React-powered** version of the Chrome extension. Clean, modern React with hooks!

## 🎯 Why React?

**Before (Vanilla JS):**
```javascript
generateBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();
  if (!text) {
    showStatus("Please enter some text", "error");
    return;
  }
  generateBtn.disabled = true;
  // ... 20+ more lines of DOM manipulation
});
```

**After (React):**
```jsx
function Popup() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const generateEmbedding = async () => {
    if (!text.trim()) {
      showStatus('Please enter some text', 'error');
      return;
    }
    setLoading(true);
    // ... clean async logic
  };

  return (
    <button onClick={generateEmbedding} disabled={loading}>
      Generate & Store
    </button>
  );
}
```

## 🚀 Setup

### 1. Install Dependencies

```bash
# First, rename package-react.json to package.json
mv package-react.json package.json

# Install dependencies
npm install
```

This installs:
- React 18 (latest)
- React DOM
- Vite (fast build tool)
- Vite React plugin

### 2. Build the Extension

```bash
npm run build
```

This will:
1. Compile JSX to optimized JavaScript
2. Copy all necessary files to `dist/` folder
3. Create a production-ready extension

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the **`dist/`** folder (not the root folder!)
5. The extension icon should appear in your toolbar

### 4. Development Mode (Optional)

For live reloading during development:

```bash
npm run dev
```

Then in another terminal:
```bash
npm run watch
```

This will rebuild automatically when you change `.jsx` files.

## 📁 Project Structure

```
bookmark.ai/
├── src/
│   ├── Popup.jsx              # Main popup component (all UI logic)
│   ├── Popup.css              # Component styles
│   └── popup-main.jsx         # Entry point that mounts React
├── dist/                      # Built extension (load this in Chrome)
│   ├── popup.html
│   ├── popup.js              # Compiled React code
│   ├── background.js         # Service worker
│   ├── db.js                 # IndexedDB storage
│   └── manifest.json
├── popup-react.html           # HTML template for React
├── background.js              # Service worker (not bundled)
├── db.js                      # IndexedDB wrapper (not bundled)
├── content.js                 # Content script (not bundled)
├── manifest.json              # Extension manifest
├── vite-react.config.js      # Vite build configuration
├── build.js                  # Post-build script to copy files
└── package.json              # Dependencies and scripts
```

## 🎨 What Changed?

### Old Files (Vanilla JS)
- ❌ `popup.html` - 300+ lines of HTML + inline styles
- ❌ `popup.js` - 200+ lines of event listeners and DOM manipulation

### New Files (React)
- ✅ `src/Popup.jsx` - ~280 lines of clean React code
- ✅ `src/Popup.css` - Separate, organized styles
- ✅ React hooks for state management
- ✅ No manual DOM manipulation
- ✅ Component-based architecture

### Unchanged Files
- ✅ `background.js` - Service worker (works as-is)
- ✅ `db.js` - IndexedDB wrapper (works as-is)
- ✅ `content.js` - Content script (works as-is)
- ✅ `manifest.json` - Extension config (same)

## 🔥 Benefits of React

1. **Hooks for State Management**
   ```jsx
   const [text, setText] = useState('');
   const [loading, setLoading] = useState(false);
   ```

2. **Declarative UI**
   ```jsx
   {embeddings.length === 0 ? (
     <div>No embeddings</div>
   ) : (
     embeddings.map(e => <div key={e.id}>{e.text}</div>)
   )}
   ```

3. **useEffect for Side Effects**
   ```jsx
   useEffect(() => {
     loadEmbeddings();
   }, []); // Runs once on mount
   ```

4. **Controlled Components**
   ```jsx
   <input 
     value={text} 
     onChange={(e) => setText(e.target.value)} 
   />
   ```

5. **Huge Ecosystem**
   - Easy to add libraries (React Query, Zustand, etc.)
   - Great dev tools
   - Massive community

## 📊 Code Comparison

### State Management

**Vanilla JS:**
```javascript
let text = '';
const textInput = document.getElementById('textInput');
textInput.addEventListener('input', (e) => {
  text = e.target.value;
});
```

**React:**
```jsx
const [text, setText] = useState('');
<textarea value={text} onChange={(e) => setText(e.target.value)} />
```

### Conditional Rendering

**Vanilla JS:**
```javascript
if (embeddings.length === 0) {
  embeddingsList.innerHTML = '<div class="empty-state">No embeddings</div>';
} else {
  embeddingsList.innerHTML = embeddings.map(e => `
    <div class="embedding-item">${e.text}</div>
  `).join('');
}
```

**React:**
```jsx
{embeddings.length === 0 ? (
  <div className="empty-state">No embeddings</div>
) : (
  embeddings.map(embedding => (
    <div key={embedding.id} className="embedding-item">
      {embedding.text}
    </div>
  ))
)}
```

### Event Handling

**Vanilla JS:**
```javascript
generateBtn.addEventListener('click', async () => {
  // handler logic
});
```

**React:**
```jsx
<button onClick={generateEmbedding}>Generate</button>
```

### Loading on Mount

**Vanilla JS:**
```javascript
// At the end of the file
loadEmbeddings();
```

**React:**
```jsx
useEffect(() => {
  loadEmbeddings();
}, []);
```

## 🛠️ Development Tips

### Hot Module Replacement

Vite provides instant hot reloading:
1. Run `npm run dev`
2. Edit `src/Popup.jsx`
3. Changes appear instantly in browser

### React DevTools

Install the [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) extension to:
- Inspect component hierarchy
- View props and state
- Debug performance

### Debugging

- **Chrome DevTools**: Works normally, inspect the popup
- **Console Logs**: Use `console.log()` in components
- **React DevTools**: See component tree and state

### Common Issues

**Issue**: Extension not updating after rebuild
- **Fix**: Go to `chrome://extensions/` and click the refresh icon

**Issue**: `dist/` folder is empty
- **Fix**: Run `npm run build` (not just `vite build`)

**Issue**: Module errors in background.js
- **Fix**: Background.js is not bundled by Vite, it runs as-is

**Issue**: "React is not defined"
- **Fix**: Make sure you import React at the top: `import React from 'react';`

## 🎓 React Hooks Used

### `useState`
Manages component state:
```jsx
const [text, setText] = useState('');
setText('new value'); // Updates state and re-renders
```

### `useEffect`
Runs side effects (like loading data):
```jsx
useEffect(() => {
  loadEmbeddings();
}, []); // Empty array = run once on mount
```

### No other hooks needed!
This component is simple enough that we only need these two core hooks.

## 🚀 Advanced React Features (Optional)

### Add Custom Hooks

Create `src/useEmbeddings.js`:
```jsx
import { useState, useEffect } from 'react';

export function useEmbeddings() {
  const [embeddings, setEmbeddings] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadEmbeddings = async () => {
    setLoading(true);
    const response = await chrome.runtime.sendMessage({ action: 'getEmbeddings' });
    setEmbeddings(response.embeddings);
    setLoading(false);
  };

  useEffect(() => {
    loadEmbeddings();
  }, []);

  return { embeddings, loading, loadEmbeddings };
}
```

Then use in component:
```jsx
function Popup() {
  const { embeddings, loading, loadEmbeddings } = useEmbeddings();
  // ...
}
```

### Split into Multiple Components

Create `src/EmbeddingList.jsx`:
```jsx
function EmbeddingList({ embeddings, onDelete }) {
  return (
    <div className="embeddings-list">
      {embeddings.map(embedding => (
        <EmbeddingItem 
          key={embedding.id} 
          embedding={embedding} 
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
```

### Add State Management (if needed)

For larger apps, consider:
- **Context API** (built-in)
- **Zustand** (tiny, simple)
- **Redux Toolkit** (powerful, complex)

## 🔄 Migrating Back to Vanilla JS

If you want to go back:
1. Use the original `popup.html` and `popup.js`
2. Update `manifest.json` to point to `popup.html` (not `dist/popup.html`)
3. No build step needed

## 📚 Learn More

- [React Docs](https://react.dev/)
- [React Hooks](https://react.dev/reference/react)
- [Vite Docs](https://vitejs.dev/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

## 🎉 Enjoy Modern React!

Your popup is now powered by React - the most popular JavaScript library with a massive ecosystem!

### Why React Over Svelte?

- ✅ **Larger ecosystem**: More libraries, tools, and resources
- ✅ **More jobs**: React skills are in higher demand
- ✅ **Mature**: Been around longer, more stable
- ✅ **Corporate backing**: Maintained by Meta (Facebook)
- ✅ **React Native**: Can use similar skills for mobile apps

### When to Choose Svelte Instead?

- Smaller bundle size needed
- Prefer less boilerplate
- Want simpler syntax
- Don't need huge ecosystem

Both are excellent choices! 🚀
