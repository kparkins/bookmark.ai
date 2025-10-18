// Content extraction utilities for getting clean text from web pages

function extractPageContentFunction() {
  try {
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

    const bodyClone = document.body.cloneNode(true);
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
      document.querySelector('meta[property="og:title"]')?.content ||
      document.title;

    return {
      success: true,
      title: title,
      content: text.substring(0, 5000),
      url: window.location.href,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function extractContentFromUrl(url, options = {}) {
  try {
    // Check if the URL is already open in a tab
    const tabs = await chrome.tabs.query({ url: url });

    if (tabs.length > 0) {
      // Use the existing tab
      const tab = tabs[0];
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContentFunction,
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    }

    // Don't create tabs during background import - fallback to fetch
    return {
      success: false,
      error: "URL not open in any tab, use fetch fallback",
    };
  } catch (error) {
    console.error("Error extracting content:", error);
    return { success: false, error: error.message };
  }
}

export function extractContentFromHTML(html, url) {
  try {
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (mainMatch) cleaned = mainMatch[1];
    else if (articleMatch) cleaned = articleMatch[1];

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
