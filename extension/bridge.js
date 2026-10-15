/*
 * Content script on the Feedbeat import page. The page can't talk to the
 * extension directly, so this relays its commands to the service worker and
 * pushes every change of the scan back to it, so the site can run the scan.
 */
(function () {
  "use strict";

  const L = globalThis.FeedbeatLib;
  // Page command → worker message. Nothing else gets through.
  const COMMANDS = {
    hello: "feedbeat:get",
    start: "feedbeat:start",
    pause: "feedbeat:pause",
    reset: "feedbeat:reset",
    batch: "feedbeat:batch",
    published: "feedbeat:published",
  };
  const version = chrome.runtime.getManifest().version;

  const post = (msg) => window.postMessage({ source: "feedbeat-extension", version, ...msg }, window.location.origin);

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== "feedbeat-page") return;
    const { id, type, payload } = event.data;
    if (!COMMANDS[type]) return;
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: COMMANDS[type], payload });
    } catch (err) {
      // After an update this old copy of the script is cut off from the extension; Chrome throws right here instead of rejecting.
      res = {
        ok: false,
        error: /context invalidated/i.test(err?.message ?? "") ? "The extension was updated. Reload this page." : (err?.message ?? "Extension error."),
      };
    }
    post({ type: "reply", id, ...(res ?? { ok: false, error: "No answer from the extension." }) });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.scan) post({ type: "state", state: L.summarize(changes.scan.newValue ?? null) });
  });

  // In case the page asked before this script loaded.
  post({ type: "present" });
})();
