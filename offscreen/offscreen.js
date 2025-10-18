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
  console.log("[Offscreen] Received message:", message.action);

  if (message.action === "extractContent") {
    console.log("[Offscreen] Extracting content from:", message.url);
    extractContentFromUrl(message.url)
      .then((result) => {
        console.log(
          "[Offscreen] Extraction result:",
          result.success ? "success" : "failed",
        );
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Offscreen] Extraction error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

async function extractContentFromUrl(url) {
  // Try iframe extraction first (best quality)
  const iframeResult = await extractViaIframe(url);

  if (iframeResult.success) {
    return iframeResult;
  }

  // Fallback to fetch if iframe fails (CORS, etc)
  console.log(
    "[Offscreen] Iframe failed, trying fetch fallback:",
    iframeResult.error,
  );
  return await extractViaFetch(url);
}

async function extractViaIframe(url) {
  return new Promise((resolve) => {
    const iframe = document.getElementById("content-frame");
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: "Timeout loading page" });
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
      iframe.src = "about:blank";
    }

    function onError() {
      cleanup();
      resolve({ success: false, error: "Failed to load iframe" });
    }

    function onLoad() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;

        // Check if we can access the document (CORS check)
        if (!doc || !doc.body) {
          cleanup();
          resolve({
            success: false,
            error: "Cannot access iframe content (CORS)",
          });
          return;
        }

        const unwantedSelectors = [
          "script",
          "style",
          "noscript",
          "iframe",
          "nav",
          "header:not(article header)",
          "footer:not(article footer)",
          "aside",
          '[role="navigation"]',
          '[role="banner"]',
          ".advertisement",
          ".ad",
          ".ads",
          ".sidebar",
          ".social-share",
          ".comments",
          "#comments",
        ];

        const bodyClone = doc.body.cloneNode(true);
        unwantedSelectors.forEach((selector) => {
          bodyClone.querySelectorAll(selector).forEach((el) => el.remove());
        });

        const contentSelectors = [
          "main",
          "article",
          '[role="main"]',
          ".main-content",
          ".content",
          ".post-content",
          ".article-content",
          ".entry-content",
          "#content",
        ];

        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = bodyClone.querySelector(selector);
          if (contentElement) break;
        }

        if (!contentElement) contentElement = bodyClone;

        let text = contentElement.innerText || contentElement.textContent || "";
        text = text.replace(/\s+/g, " ").trim();

        const title =
          doc.querySelector('meta[property="og:title"]')?.content || doc.title;

        cleanup();
        resolve({
          success: true,
          title: title,
          content: text.substring(0, 5000),
          url: url,
        });
      } catch (error) {
        cleanup();
        resolve({ success: false, error: error.message });
      }
    }

    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
    iframe.src = url;
  });
}

async function extractViaFetch(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Remove scripts, styles, and common noise
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

    // Try to extract main/article content
    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (mainMatch) cleaned = mainMatch[1];
    else if (articleMatch) cleaned = articleMatch[1];

    // Strip all remaining HTML tags
    cleaned = cleaned
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      success: true,
      content: cleaned.substring(0, 5000),
      url: url,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
