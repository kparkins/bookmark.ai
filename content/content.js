// Content script for handling text selection and interaction with the page

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
  return true;
});

// Optional: Add a visual indicator when text is selected
let selectionTimeout;

document.addEventListener('mouseup', () => {
  clearTimeout(selectionTimeout);

  selectionTimeout = setTimeout(() => {
    const selectedText = window.getSelection().toString().trim();

    if (selectedText) {
      // Text is selected - user can right-click to generate embedding
      console.log('Text selected:', selectedText.substring(0, 50) + '...');
    }
  }, 100);
});

console.log('Text Embedding Generator content script loaded');
