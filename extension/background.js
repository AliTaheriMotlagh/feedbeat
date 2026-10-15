/*
 * Service worker. Orchestrates one collection: asks the X tab for the posts,
 * adds the account id from the signed-in cookie, stores the batch and opens
 * Feedbeat. The batch is handed to the site page once, then deleted.
 */
importScripts("lib.js");

const { SITE_URL, SITE_ORIGINS, accountIdFromTwid } = self.FeedbeatLib;

async function collectFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https:\/\/x\.com\//.test(tab.url ?? "")) {
    throw new Error("Open your own X profile in the active tab first.");
  }

  let result;
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: "feedbeat:collect" });
  } catch {
    throw new Error("Reload the X tab once, then try again.");
  }
  if (!result?.ok) throw new Error(result?.error ?? "Couldn't read your profile.");

  const twid = await chrome.cookies.get({ url: "https://x.com", name: "twid" });
  const accountId = accountIdFromTwid(twid?.value);
  if (!accountId) throw new Error("Couldn't confirm your X account. Make sure you're signed in to X.");

  const batch = {
    account: { accountId, username: result.handle, displayName: null },
    profile: { bio: null, avatarUrl: null },
    tweetsScanned: result.tweetsScanned,
    items: result.items,
  };
  await chrome.storage.local.set({ batch });
  await chrome.tabs.create({ url: `${SITE_URL}/import/extension` });
  return { count: result.items.length };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "feedbeat:start") {
    collectFromActiveTab().then(
      (r) => sendResponse({ ok: true, ...r }),
      (err) => sendResponse({ ok: false, error: err.message }),
    );
    return true;
  }

  if (msg?.type === "feedbeat:take-batch") {
    // Only the Feedbeat site may read the batch, and only once.
    const origin = sender.url ? new URL(sender.url).origin : "";
    if (!SITE_ORIGINS.includes(origin)) {
      sendResponse({ batch: null });
      return false;
    }
    chrome.storage.local.get("batch").then(async ({ batch }) => {
      await chrome.storage.local.remove("batch");
      sendResponse({ batch: batch ?? null });
    });
    return true;
  }

  return false;
});
