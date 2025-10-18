const port = chrome.runtime.connect({ name: "offscreen-keepalive" });

let pingTimer = setInterval(() => {
  chrome.runtime.sendMessage({ action: "keepalive:ping", ts: Date.now() });
}, 3000);

port.onDisconnect.addListener(() => {
  clearInterval(pingTimer);
  pingTimer = null;
});

self.addEventListener("unload", () => {
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  port.disconnect();
});

// Content extraction functionality
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent') {
    extractContentFromUrl(message.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function extractContentFromUrl(url) {
  return new Promise((resolve) => {
    const iframe = document.getElementById('content-frame');
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: 'Timeout loading page' });
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      iframe.removeEventListener('load', onLoad);
      iframe.src = 'about:blank';
    }

    function onLoad() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        const unwantedSelectors = [
          'script', 'style', 'noscript', 'iframe', 'nav',
          'header:not(article header)', 'footer:not(article footer)',
          'aside', '[role="navigation"]', '[role="banner"]',
          '.advertisement', '.ad', '.ads', '.sidebar'
        ];

        const bodyClone = doc.body.cloneNode(true);
        unwantedSelectors.forEach((selector) => {
          bodyClone.querySelectorAll(selector).forEach((el) => el.remove());
        });

        const contentSelectors = [
          'main', 'article', '[role="main"]',
          '.main-content', '.content', '.post-content'
        ];

        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = bodyClone.querySelector(selector);
          if (contentElement) break;
        }

        if (!contentElement) contentElement = bodyClone;

        let text = contentElement.innerText || contentElement.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();

        const title = doc.querySelector('meta[property="og:title"]')?.content || doc.title;

        cleanup();
        resolve({
          success: true,
          title: title,
          content: text.substring(0, 5000),
          url: url
        });
      } catch (error) {
        cleanup();
        resolve({ success: false, error: error.message });
      }
    }

    iframe.addEventListener('load', onLoad);
    iframe.src = url;
  });
}
