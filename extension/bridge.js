/*
 * Content script on the Feedbeat import page. The page can't read extension
 * storage, so this relays the collected batch to it once it says it's ready.
 */
window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data?.source !== "feedbeat-page" || event.data.type !== "ready") return;
  const res = await chrome.runtime.sendMessage({ type: "feedbeat:take-batch" }).catch(() => null);
  window.postMessage({ source: "feedbeat-extension", type: "batch", batch: res?.batch ?? null }, window.location.origin);
});
