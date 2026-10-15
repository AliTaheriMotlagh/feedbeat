/*
 * Content script for x.com. Runs only when the popup asks for it, and only
 * on the signed-in user's own profile. It scrolls the profile and keeps the
 * music links from posts written by that account.
 */
(function () {
  "use strict";

  const { isMusicUrl, musicUrlsInText, toUrl } = globalThis.FeedbeatLib;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Handle of the account signed in to this browser (from the nav bar). */
  function signedInHandle() {
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    const m = /^\/([A-Za-z0-9_]{1,15})$/.exec(link?.getAttribute("href") ?? "");
    return m ? m[1] : null;
  }

  /** Read every post rendered right now and keep the ones written by `handle`. */
  function readVisible(state) {
    const own = new RegExp(`^/${state.handle}/status/(\\d{1,25})`, "i");
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const time = article.querySelector("time");
      const href = time?.closest("a[href]")?.getAttribute("href") ?? "";
      // Reposts, replies shown in threads and ads point at someone else's status.
      const m = own.exec(href);
      if (!m || !time.getAttribute("datetime")) continue;
      const tweetId = m[1];
      if (state.seen.has(tweetId)) continue;
      state.seen.add(tweetId);

      const tweetedAt = time.getAttribute("datetime");
      const text = article.querySelector('[data-testid="tweetText"]')?.innerText ?? "";
      // X wraps links in t.co; the real destination is in the title or the visible text.
      // Link cards and "…" truncated links often show up only as text, so read that too.
      const urls = new Set(musicUrlsInText(article.innerText));
      for (const a of article.querySelectorAll("a[href]")) {
        const url = [a.getAttribute("title"), a.textContent].map(toUrl).find((u) => u && isMusicUrl(u));
        if (url) urls.add(url);
      }
      for (const url of urls) {
        const prev = state.items.get(url);
        if (!prev || tweetedAt < prev.tweetedAt) {
          state.items.set(url, { url, tweetId, tweetedAt, text: text.slice(0, 500) });
        }
      }
    }
  }

  async function collect() {
    const handle = signedInHandle();
    if (!handle) throw new Error("Sign in to X in this browser first.");
    if (location.pathname.split("/")[1]?.toLowerCase() !== handle.toLowerCase()) {
      throw new Error(`Open your own profile (x.com/${handle}) first.`);
    }

    const state = { handle, seen: new Set(), items: new Map() };
    let idle = 0;
    // Stop after ~10 s without new posts, or after a hard cap of rounds.
    for (let round = 0; round < 400 && idle < 8; round++) {
      const before = state.seen.size;
      readVisible(state);
      idle = state.seen.size === before ? idle + 1 : 0;
      window.scrollBy(0, window.innerHeight * 2);
      await sleep(1200);
    }
    readVisible(state);
    return { handle, tweetsScanned: state.seen.size, items: [...state.items.values()] };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "feedbeat:collect") return false;
    collect().then(
      (result) => sendResponse({ ok: true, ...result }),
      (err) => sendResponse({ ok: false, error: err.message }),
    );
    return true; // respond asynchronously
  });
})();
