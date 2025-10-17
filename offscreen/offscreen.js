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
