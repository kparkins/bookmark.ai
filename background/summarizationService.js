import { pipeline } from "@huggingface/transformers";
import { ensureKeepAlive, releaseKeepAlive } from "./keepAlive.js";
import {
  extractContentFromUrl,
  extractContentFromHTML,
} from "./contentExtractor.js";

let summarizationPipeline = null;

const CHUNK_SIZE = 4000;
const MAX_CHUNKS = 2;

async function getSummarizer() {
  if (summarizationPipeline) {
    return summarizationPipeline;
  }

  try {
    summarizationPipeline = await pipeline("summarization", "Xenova/t5-small", {
      taskName: "summarization",
    });
  } catch (error) {
    console.error("Failed to initialize summarizer:", error);
    summarizationPipeline = null;
  }

  return summarizationPipeline;
}

function sanitizeHtml(html) {
  if (!html) {
    return "";
  }

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(?:p|div|br|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateSummaryForUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  await ensureKeepAlive();

  // Try to extract content using content script first
  let cleanText = null;
  const extractResult = await extractContentFromUrl(url);

  if (extractResult.success && extractResult.content) {
    cleanText = extractResult.content;
    console.log(`Extracted ${cleanText.length} chars using content script`);
  } else {
    // Fallback to fetch-based approach
    console.warn(`Content script failed for ${url}, falling back to fetch`);

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        mode: "cors",
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      console.warn(`Unable to fetch content for ${url}:`, error.message);
      await releaseKeepAlive();
      return null;
    }

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      await releaseKeepAlive();
      return null;
    }

    let rawHtml;
    try {
      rawHtml = await response.text();
    } catch (error) {
      console.warn(`Failed to read response body for ${url}:`, error.message);
      await releaseKeepAlive();
      return null;
    }

    const htmlExtract = extractContentFromHTML(rawHtml, url);
    if (htmlExtract.success && htmlExtract.content) {
      cleanText = htmlExtract.content;
    } else {
      cleanText = sanitizeHtml(rawHtml);
    }
  }

  if (!cleanText) {
    await releaseKeepAlive();
    return null;
  }

  const chunks = chunkText(cleanText, CHUNK_SIZE, MAX_CHUNKS);
  const summarizer = await getSummarizer();

  if (!summarizer) {
    return null;
  }

  try {
    const chunkSummaries = [];

    for (const chunk of chunks) {
      const output = await summarizer(chunk, {
        max_new_tokens: 120,
        min_length: 40,
        do_sample: false,
      });

      const summary = Array.isArray(output) ? output[0]?.summary_text : null;
      if (typeof summary === "string" && summary.trim()) {
        chunkSummaries.push(summary.trim());
      }
    }

    if (chunkSummaries.length === 0) {
      return null;
    }

    if (chunkSummaries.length === 1) {
      const result = chunkSummaries[0];
      await releaseKeepAlive();
      return result;
    }

    const combined = chunkSummaries.join(" ");
    const finalInput =
      combined.length > CHUNK_SIZE ? combined.slice(0, CHUNK_SIZE) : combined;

    try {
      const finalOutput = await summarizer(finalInput, {
        max_new_tokens: 120,
        min_length: 60,
        do_sample: false,
      });
      const finalSummary = Array.isArray(finalOutput)
        ? finalOutput[0]?.summary_text
        : null;
      if (typeof finalSummary === "string" && finalSummary.trim()) {
        const result = finalSummary.trim();
        await releaseKeepAlive();
        return result;
      }
    } catch (finalError) {
      console.warn("Failed to combine summaries:", finalError);
    }

    const fallback = chunkSummaries.join(" ").slice(0, CHUNK_SIZE).trim();
    await releaseKeepAlive();
    return fallback;
  } catch (error) {
    console.error(`Failed to summarize content for ${url}:`, error);
  }

  await releaseKeepAlive();
  return null;
}

function chunkText(text, size = CHUNK_SIZE, maxChunks = MAX_CHUNKS) {
  const chunks = [];
  let start = 0;
  const length = text.length;

  while (start < length && chunks.length < maxChunks) {
    let end = Math.min(start + size, length);

    if (end < length) {
      const sentenceBreak = text.lastIndexOf(". ", end);
      const spaceBreak = text.lastIndexOf(" ", end);

      if (sentenceBreak > start) {
        end = sentenceBreak + 1;
      } else if (spaceBreak > start) {
        end = spaceBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    start = end;
  }

  if (chunks.length === 0) {
    chunks.push(text.slice(0, size));
  }

  return chunks;
}
