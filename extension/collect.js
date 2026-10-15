/*
 * Content script for x.com (tabs and the iframe on the Feedbeat page). Does
 * nothing unless the service worker says this page is running a scan. Then it
 * scrolls the signed-in account's posts, newest first:
 *  1. the profile timeline (posts and replies). X lists every post there, but
 *     only the latest ~3,200, and search leaves posts out for some accounts;
 *  2. for older posts, X search ("from:you filter:links"), one date window at a
 *     time: X stops serving a search after a few hundred results, so when a
 *     window runs dry it reloads the search ending at the oldest day reached.
 * Progress goes to the worker after every few posts, so a scan can stop
 * anywhere and continue.
 */
(function () {
  "use strict";

  const L = globalThis.FeedbeatLib;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const IDLE_ROUNDS = 8; // rounds without new posts before a page counts as finished
  const EMPTY_GRACE = 3; // ...but after an empty page (how X ends a timeline) only this many more
  const OLDER_ENOUGH = 3; // posts older than the newest one we have before a "new" scan stops
  const REPORT_EVERY = 3000; // ms; also how fast a pause from the site is noticed
  const RETRY_DELAYS = [15, 30, 60, 120].map((s) => s * 1000);
  const COOLDOWN = 15 * 60 * 1000; // X's rate-limit window, the longest we wait
  const MIN_COOLDOWN = 15 * 1000;
  const RESET_SLACK = 5 * 1000; // past the moment X says its window resets
  const NAV_KEY = "feedbeat:nav";
  const BLANK_KEY = "feedbeat:blank";

  let running = false;
  const hookBodies = [];
  let rateLimited = false;
  let resetAt = null; // when X said the rate-limit window resets (ms), if it said

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "feedbeat-hook" || !running) return;
    if (e.data.type === "data") hookBodies.push(e.data.body);
    if (e.data.type === "ratelimit") {
      rateLimited = true;
      resetAt = Number(e.data.reset) * 1000 || null;
    }
  });

  /** How long to wait after X says "slow down": until its window resets when it says when, never longer than the usual 15 minutes. */
  function cooldownMs() {
    if (!resetAt) return COOLDOWN;
    return Math.min(COOLDOWN, Math.max(resetAt - Date.now() + RESET_SLACK, MIN_COOLDOWN));
  }

  /* ------------------------------- Page reads ------------------------------ */

  /** Handle of the account signed in to this browser (from the nav bar). */
  function signedInHandle() {
    const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    const m = /^\/([A-Za-z0-9_]{1,15})$/.exec(link?.getAttribute("href") ?? "");
    return m ? m[1] : null;
  }

  const column = () => document.querySelector('[data-testid="primaryColumn"]') ?? document.body;
  const isEmpty = () => !!column().querySelector('[data-testid="emptyState"]');
  const isLoading = () => !!column().querySelector('[role="progressbar"]');
  const retryButton = () =>
    [...column().querySelectorAll('button, [role="button"]')].find((b) => b.textContent?.trim() === "Retry") ?? null;

  /** The quoted post inside a post, if any (its links aren't ours). */
  function quoteOf(article) {
    return [...article.querySelectorAll('div[role="link"]')].find((el) => el.querySelector("time")) ?? null;
  }

  /** Fallback when X's data can't be read: posts as rendered on the page. */
  function tweetsFromDom(handle) {
    const own = new RegExp(`^/${handle}/status/(\\d{1,25})`, "i");
    const tweets = [];
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const quote = quoteOf(article);
      const time = [...article.querySelectorAll("time")].find((t) => !quote?.contains(t));
      const m = own.exec(time?.closest("a[href]")?.getAttribute("href") ?? "");
      // Reposts and ads point at someone else's status.
      if (!m || !time.getAttribute("datetime")) continue;

      // "Pinned" is a social context without a link; "… reposted" links to the reposter.
      const context = article.querySelector('[data-testid="socialContext"]');
      const pinned = !!context && !context.closest("a[href]") && !context.querySelector("a[href]");
      const text = article.querySelector('[data-testid="tweetText"]')?.innerText ?? "";
      const visible = quote ? article.innerText.replace(quote.innerText, "") : article.innerText;
      const urls = L.musicUrlsInText(visible);
      for (const a of article.querySelectorAll("a[href]")) {
        if (quote?.contains(a)) continue;
        // X hides the rest of a long link in invisible spans, so textContent has it all.
        for (const raw of [a.getAttribute("title"), a.textContent?.replace(/…$/, "")]) {
          const url = L.toUrl(raw);
          if (url && L.isMusicUrl(url)) urls.push(url);
        }
      }
      const tweet = { tweetId: m[1], tweetedAt: new Date(time.getAttribute("datetime")).toISOString(), text, urls };
      if (pinned) tweet.pinned = true;
      tweets.push(tweet);
    }
    return tweets;
  }

  /**
   * Posts from X's own timeline data, captured by hook.js. `lastEmpty` says whether the latest response
   * had no posts at all (null when none arrived): X ends a timeline with a page of nothing but cursors.
   */
  function readHook(accountId, onProfile) {
    const tweets = [];
    let lastEmpty = null;
    for (const body of hookBodies.splice(0)) {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        continue;
      }
      const res = L.tweetsFromGraphql(json, accountId);
      tweets.push(...res.tweets);
      if (res.profile) onProfile(res.profile);
      lastEmpty = L.hasNoPosts(json);
    }
    return { tweets, lastEmpty };
  }

  async function waitFor(fn, timeout) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v || Date.now() > end) return v;
      await sleep(250);
    }
  }

  function waitVisible() {
    return new Promise((resolve) => {
      if (!document.hidden) return resolve();
      const on = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", on);
        resolve();
      };
      document.addEventListener("visibilitychange", on);
    });
  }

  /* --------------------------------- Scan ---------------------------------- */

  function samePage(a, b) {
    try {
      const [x, y] = [new URL(a), new URL(b)];
      const same = (k) => x.searchParams.get(k) === y.searchParams.get(k);
      return x.pathname.toLowerCase() === y.pathname.toLowerCase() && same("q") && same("f");
    } catch {
      return false;
    }
  }

  /** Go to `url`, unless we've been bounced away from it a few times already. */
  function navigate(url) {
    const tries = sessionStorage.getItem(NAV_KEY) === url ? 1 : 0;
    if (tries) throw new Error("X didn't open your posts. Check that X works in this browser, then press Continue.");
    sessionStorage.setItem(NAV_KEY, url);
    location.assign(url);
  }

  async function run(scan) {
    const report = async (patch) => {
      const res = await chrome.runtime.sendMessage({ type: "feedbeat:progress", payload: { runId: scan.runId, ...patch } });
      return res?.ok ? res : { stop: true };
    };

    // 1. Make sure the right account is signed in.
    const handle = await waitFor(signedInHandle, 20_000);
    if (!handle) {
      return report({
        status: "error",
        message: scan.inFrame
          ? "X shows you as signed out inside this page (your browser keeps X's sign-in out of frames). Use “Scan in an X tab” instead."
          : "Sign in to X in this tab, then press Continue.",
      });
    }
    if (scan.handle && scan.handle.toLowerCase() !== handle.toLowerCase()) {
      return report({ status: "error", message: `X is signed in as @${handle}, but the scan is for @${scan.handle}. Switch accounts or start over.` });
    }
    if (!scan.handle) await report({ handle });

    // 2. Open this run's page: the profile timeline, or a search window for older posts.
    const onProfile = L.onProfile(scan);
    const expected = onProfile ? L.profileUrl(handle) : L.searchUrl(handle, { until: scan.until, since: scan.since });
    if (!samePage(location.href, expected)) return navigate(expected);
    sessionStorage.removeItem(NAV_KEY);

    // 3. Scroll until the page runs dry, sending progress as we go.
    window.postMessage({ source: "feedbeat-cs", type: "flush" }, window.location.origin);
    const seen = new Set(scan.seen);
    const windowIds = new Set();
    const dates = new Map(); // post id → date, for this page
    const pinnedIds = new Set();
    let pending = [];
    let profile = null;
    let idle = 0;
    let emptyPage = false; // the latest timeline response had no posts: the end, unless more follows right away
    let retries = 0;
    let lastReport = 0;
    let hiddenWarned = false;

    await waitFor(() => document.querySelector('article[data-testid="tweet"]') || isEmpty() || retryButton(), 20_000);

    for (;;) {
      if (document.hidden) {
        if (!hiddenWarned) await report({ message: "Waiting: bring this tab back to the front. X only loads posts while it's on screen." });
        hiddenWarned = true;
        await waitVisible();
        continue;
      }

      const hooked = readHook(scan.accountId, (p) => (profile = p));
      if (hooked.lastEmpty !== null) emptyPage = hooked.lastEmpty;
      const found = [...hooked.tweets, ...tweetsFromDom(handle)];
      let grew = false;
      for (const t of found) {
        if (t.pinned) pinnedIds.add(t.tweetId);
        if (windowIds.has(t.tweetId)) continue;
        windowIds.add(t.tweetId);
        dates.set(t.tweetId, t.tweetedAt);
        grew = true;
        if (!seen.has(t.tweetId)) {
          seen.add(t.tweetId);
          pending.push(t);
        }
      }
      idle = grew ? 0 : idle + 1;
      // X ends a timeline with a page of nothing but cursors: a few quiet rounds after that are enough, not the full wait.
      if (emptyPage && !grew) idle = Math.max(idle, IDLE_ROUNDS - EMPTY_GRACE);

      if (pending.length || profile || hiddenWarned || Date.now() - lastReport > REPORT_EVERY) {
        const res = await report({ tweets: pending, ...(profile && { profile }), ...(hiddenWarned && { message: null }) });
        pending = [];
        profile = null;
        hiddenWarned = false;
        lastReport = Date.now();
        if (res.stop) return;
      }

      if (rateLimited) {
        const resumeAt = Date.now() + cooldownMs();
        const at = new Date(resumeAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return report({ status: "cooldown", resumeAt, message: `X asked us to slow down. Continuing automatically at ${at}.` });
      }

      const retry = retryButton();
      if (retry) {
        if (retries >= RETRY_DELAYS.length) {
          const resumeAt = Date.now() + COOLDOWN;
          return report({ status: "cooldown", resumeAt, message: "X keeps failing to load posts. Trying again in 15 minutes." });
        }
        await sleep(RETRY_DELAYS[retries++]);
        retry.click();
        idle = 0;
        await sleep(2000);
        continue;
      }

      if (windowIds.size === 0 && isEmpty()) break;
      if (idle >= IDLE_ROUNDS && !isLoading()) break;
      // A "new" scan is done once it is past the newest post collected before.
      if (scan.mode === "new" && countOlder(dates, pinnedIds, scan.newest) >= OLDER_ENOUGH) break;

      // Scrolling to where we already are fires no scroll event and X wouldn't load more, so back up a little first.
      if (idle > 0) {
        window.scrollBy(0, -800);
        await sleep(300);
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(900 + Math.random() * 700);
    }

    // 4. Page done. A "new" scan is finished; the profile pass hands over to search; a search loads the next window.
    if (windowIds.size === 0 && !isEmpty() && sessionStorage.getItem(BLANK_KEY) !== location.href) {
      // Nothing loaded and no "no results" either: give X one more try before calling it done.
      sessionStorage.setItem(BLANK_KEY, location.href);
      return location.reload();
    }
    sessionStorage.removeItem(BLANK_KEY);
    const oldest = oldestOf(dates, pinnedIds);
    if (scan.mode === "new") return report({ status: "done", tweets: pending, message: "You're up to date." });
    if (onProfile) {
      // Search on from the day of the oldest post the profile showed (that day is re-read, duplicates are skipped).
      const until = oldest ? L.nextUntil(oldest, null) : null;
      const res = await report({ tweets: pending, phase: "search", until });
      if (!res.stop) navigate(L.searchUrl(handle, { until }));
      return;
    }
    if (windowIds.size === 0) {
      return report({ status: "done", tweets: pending, message: scan.mode === "all" ? "Reached your first post." : "You're up to date." });
    }
    if (!oldest) return report({ status: "done", tweets: pending, message: "Reached your first post." });
    const until = L.nextUntil(oldest, scan.until);
    if (scan.since && until <= scan.since) {
      return report({ status: "done", tweets: pending, message: "You're up to date." });
    }
    const res = await report({ tweets: pending, until });
    if (!res.stop) navigate(L.searchUrl(handle, { until, since: scan.since }));
  }

  /** The oldest post on this page, leaving out the pinned one. */
  function oldestOf(dates, pinnedIds) {
    let oldest = null;
    for (const [id, at] of dates) if (!pinnedIds.has(id) && (!oldest || at < oldest)) oldest = at;
    return oldest;
  }

  function countOlder(dates, pinnedIds, than) {
    if (!than) return 0;
    let n = 0;
    for (const [id, at] of dates) if (!pinnedIds.has(id) && at < than) n++;
    return n;
  }

  async function init() {
    if (running) return;
    const res = await chrome.runtime.sendMessage({ type: "feedbeat:whoami" }).catch(() => null);
    if (!res?.ok || !res.run) return;
    running = true;
    try {
      await run(res.scan);
    } catch (err) {
      await chrome.runtime
        .sendMessage({ type: "feedbeat:progress", payload: { runId: res.scan.runId, status: "error", message: err.message } })
        .catch(() => {});
    } finally {
      running = false;
    }
  }

  init();
})();
