let keepAliveCount = 0;
let creatingOffscreen = null;
let offscreenReady = false;

async function hasOffscreenDocument() {
  if (typeof chrome.offscreen?.hasDocument !== "function") {
    return offscreenReady;
  }
  try {
    return await chrome.offscreen.hasDocument({
      url: "offscreen/offscreen.html",
    });
  } catch (error) {
    console.warn("Unable to check offscreen document:", error);
    return offscreenReady;
  }
}

export async function ensureKeepAlive() {
  keepAliveCount++;

  if (keepAliveCount > 1) {
    return;
  }

  if (!(await hasOffscreenDocument())) {
    if (!creatingOffscreen) {
      creatingOffscreen = chrome.offscreen
        .createDocument({
          url: "offscreen/offscreen.html",
          reasons: ["BLOBS"],
          justification: "Keep summarizer alive during long-running imports",
        })
        .catch((error) => {
          if (error?.message?.includes("single offscreen")) {
            // Already exists; treat as success.
            offscreenReady = true;
            return;
          }
          console.error("Failed to create offscreen document:", error);
          keepAliveCount = Math.max(keepAliveCount - 1, 0);
          offscreenReady = false;
          throw error;
        })
        .finally(() => {
          offscreenReady = true;
          creatingOffscreen = null;
        });
    }
    await creatingOffscreen;
  }
}

export async function releaseKeepAlive() {
  keepAliveCount = Math.max(keepAliveCount - 1, 0);

  if (keepAliveCount === 0) {
    if (await hasOffscreenDocument()) {
      try {
        await chrome.offscreen.closeDocument();
      } catch (error) {
        console.warn("Failed to close offscreen document:", error);
      }
    }
    offscreenReady = false;
  }
}
