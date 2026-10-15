/*
 * Service worker. Owns the scan state (the only writer, so commands and
 * progress never race), opens the X window the scan runs in, and hands the
 * collected links to the Feedbeat site.
 *
 * The scan itself runs in the X tab (collect.js): MV3 workers are stopped
 * after a few idle minutes, so nothing long-running lives here.
 */
importScripts("lib.js");

const L = self.FeedbeatLib;
const KEY = "scan";
const RESUME_ALARM = "feedbeat-resume";
const IMPORT_PATH = "/import/extension";

/* --------------------------------- State ---------------------------------- */

let chain = Promise.resolve();

/** Run `fn` on the stored scan, one call at a time. Return a scan to save it, null to delete it, undefined to leave it. */
function update(fn) {
  const run = chain.then(async () => {
    const { [KEY]: scan } = await chrome.storage.local.get(KEY);
    const next = await fn(scan ?? null);
    if (next === null) await chrome.storage.local.remove(KEY);
    else if (next !== undefined) {
      next.updatedAt = new Date().toISOString();
      await chrome.storage.local.set({ [KEY]: next });
    }
    return next === undefined ? (scan ?? null) : next;
  });
  chain = run.catch(() => {});
  return run;
}

const read = () => update(() => undefined);

async function currentAccountId() {
  const twid = await chrome.cookies.get({ url: L.X_ORIGIN, name: "twid" });
  return L.accountIdFromTwid(twid?.value);
}

const newRunId = () => crypto.randomUUID();

/* ------------------------------- Commands --------------------------------- */

/**
 * kind: "continue" — pick up where the scan stopped (older posts),
 *       "new"      — only posts newer than the newest one collected,
 *       "restart"  — forget everything and scan from the top.
 */
async function start(kind, returnTabId) {
  const accountId = await currentAccountId();
  if (!accountId) throw new Error("Sign in to X in this browser first, then try again.");

  const scan = await update((prev) => {
    let s = prev && prev.accountId === accountId && kind !== "restart" ? prev : L.newScan(accountId);
    const resumable = s.mode === "new" && ["paused", "cooldown", "error"].includes(s.status);
    if (kind === "new" && s.newest) {
      Object.assign(s, { mode: "new", since: L.dayOf(s.newest), until: null });
    } else if (!resumable) {
      // A finished history only has newer posts left to find.
      if (s.complete && s.newest) Object.assign(s, { mode: "new", since: L.dayOf(s.newest), until: null });
      // Otherwise re-read the oldest day reached; posts already seen are skipped.
      else Object.assign(s, { mode: "all", since: null, until: s.oldest ? L.addDays(L.dayOf(s.oldest), 1) : null });
    }
    return Object.assign(s, { status: "running", runId: newRunId(), message: null, resumeAt: null, returnTabId: returnTabId ?? null });
  });
  await chrome.alarms.clear(RESUME_ALARM);
  await openScanTab(scan);
  return L.summarize(scan);
}

/** Load the scan's next page in its own window, reusing it when it's still open. */
async function openScanTab(scan) {
  const url = scan.handle ? L.searchUrl(scan.handle, { until: scan.until, since: scan.since }) : `${L.X_ORIGIN}/home`;
  if (scan.tabId != null) {
    try {
      const tab = await chrome.tabs.update(scan.tabId, { url, active: true });
      await chrome.windows.update(tab.windowId, { focused: true, state: "normal" });
      return;
    } catch {
      // Closed since; open a new one.
    }
  }
  // X only loads more posts while the page is on screen, so the scan gets a window of its own.
  const win = await chrome.windows.create({ url, type: "popup", width: 560, height: 900, focused: true });
  const tabId = win.tabs?.[0]?.id ?? null;
  await update((s) => (s && s.runId === scan.runId ? Object.assign(s, { tabId, windowId: win.id }) : undefined));
}

async function closeScanWindow(scan) {
  if (scan?.windowId == null) return;
  await chrome.windows.remove(scan.windowId).catch(() => {});
}

async function pause(message) {
  const scan = await update((s) =>
    s && ["running", "cooldown"].includes(s.status)
      ? Object.assign(s, { status: "paused", message: message ?? "Paused. Continue any time; progress is saved.", resumeAt: null })
      : undefined,
  );
  await chrome.alarms.clear(RESUME_ALARM);
  await closeScanWindow(scan);
  if (scan) await update((s) => (s ? Object.assign(s, { tabId: null, windowId: null }) : undefined));
  return L.summarize(scan);
}

async function reset() {
  const scan = await read();
  await chrome.alarms.clear(RESUME_ALARM);
  await closeScanWindow(scan);
  await update(() => null);
  return null;
}

/** Everything the site needs to publish. Only the site may ask. */
async function buildBatch() {
  const scan = await read();
  if (!scan?.handle || !scan.items.length) throw new Error("No songs collected yet.");
  const accountId = await currentAccountId();
  if (accountId && accountId !== scan.accountId) {
    throw new Error("You're signed in to X as a different account than the one scanned. Switch back, or start over.");
  }
  const p = scan.profile ?? {};
  const avatarUrl = /^https:\/\/pbs\.twimg\.com\//.test(p.avatarUrl ?? "") ? p.avatarUrl : null;
  return {
    account: { accountId: scan.accountId, username: scan.handle, displayName: p.displayName?.slice(0, 100) ?? null },
    profile: { bio: p.bio?.slice(0, 500) ?? null, avatarUrl },
    tweetsScanned: scan.scanned,
    items: scan.items.map(({ url, tweetId, tweetedAt, text }) => ({ url, tweetId, tweetedAt, text })),
  };
}

/* ---------------------------- Collector (X tab) --------------------------- */

/** The X tab asks on every page load whether it should be scanning. */
async function whoami(sender) {
  const scan = await read();
  if (!scan || scan.status !== "running" || sender.tab?.id !== scan.tabId) return { run: false };
  const { runId, accountId, handle, mode, since, until, seen } = scan;
  return { run: true, scan: { runId, accountId, handle, mode, since, until, seen } };
}

/** Progress from the X tab. Returns stop: true once the scan was paused or replaced. */
async function progress(sender, patch) {
  let finished = null;
  const scan = await update((s) => {
    if (!s || s.runId !== patch.runId || s.status !== "running" || sender.tab?.id !== s.tabId) return undefined;
    if (patch.handle && !s.handle) s.handle = patch.handle;
    if (patch.profile?.username?.toLowerCase() === s.handle?.toLowerCase()) s.profile = patch.profile;
    if (patch.tweets?.length) L.mergeTweets(s, patch.tweets);
    if ("until" in patch) s.until = patch.until;
    if ("message" in patch) s.message = patch.message;
    if (patch.status) {
      s.status = patch.status;
      if (patch.status === "done" && s.mode === "all") s.complete = true;
      if (patch.status === "cooldown") s.resumeAt = patch.resumeAt;
      finished = s;
    }
    return s;
  });

  if (finished) await onFinished(finished);
  return { stop: !scan || scan.runId !== patch.runId || scan.status !== "running" };
}

async function onFinished(scan) {
  if (scan.status === "cooldown") {
    await chrome.alarms.create(RESUME_ALARM, { when: scan.resumeAt });
    return;
  }
  if (scan.status !== "done") return; // errors stay on screen so they can be fixed in that window
  await closeScanWindow(scan);
  await update((s) => (s ? Object.assign(s, { tabId: null, windowId: null }) : undefined));
  // Bring the person back to Feedbeat to publish.
  const back = scan.returnTabId != null ? await chrome.tabs.get(scan.returnTabId).catch(() => null) : null;
  if (back) {
    await chrome.tabs.update(back.id, { active: true });
    await chrome.windows.update(back.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: `${L.SITE_URL}${IMPORT_PATH}` });
  }
}

/* ------------------------------- Messaging -------------------------------- */

const isSite = (sender) => {
  try {
    return L.SITE_ORIGINS.includes(new URL(sender.url).origin);
  } catch {
    return false;
  }
};
const isPopup = (sender) => sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) ?? false;
const isXTab = (sender) => sender.tab != null && sender.url?.startsWith(`${L.X_ORIGIN}/`);

const HANDLERS = {
  "feedbeat:get": { from: [isSite, isPopup], run: async () => ({ state: L.summarize(await read()), signedIn: (await currentAccountId()) !== null }) },
  "feedbeat:start": { from: [isSite, isPopup], run: async (p, s) => ({ state: await start(p?.kind ?? "continue", isSite(s) ? s.tab?.id : null) }) },
  "feedbeat:pause": { from: [isSite, isPopup], run: async () => ({ state: await pause() }) },
  "feedbeat:reset": { from: [isSite, isPopup], run: async () => ({ state: await reset() }) },
  "feedbeat:open-site": { from: [isPopup], run: async () => (await chrome.tabs.create({ url: `${L.SITE_URL}${IMPORT_PATH}` }), {}) },
  "feedbeat:batch": { from: [isSite], run: async () => ({ batch: await buildBatch() }) },
  "feedbeat:published": {
    from: [isSite],
    run: async (p) => {
      const count = Number(p?.count) || 0;
      const scan = await update((s) => (s ? Object.assign(s, { published: Math.min(count, s.items.length) }) : undefined));
      return { state: L.summarize(scan) };
    },
  },
  "feedbeat:whoami": { from: [isXTab], run: (_p, s) => whoami(s) },
  "feedbeat:progress": { from: [isXTab], run: (p, s) => progress(s, p) },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler || !handler.from.some((ok) => ok(sender))) return false;
  handler.run(msg.payload, sender).then(
    (data) => sendResponse({ ok: true, ...data }),
    (err) => sendResponse({ ok: false, error: err?.message ?? "Something went wrong." }),
  );
  return true; // respond asynchronously
});

/* ------------------------------ Lifecycle --------------------------------- */

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const scan = await read();
  if (scan?.tabId !== tabId) return;
  await update((s) =>
    Object.assign(s, {
      tabId: null,
      windowId: null,
      ...(["running", "cooldown"].includes(s.status) && { status: "paused", message: "The X window was closed. Continue any time; progress is saved." }),
    }),
  );
  await chrome.alarms.clear(RESUME_ALARM);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RESUME_ALARM) return;
  const scan = await update((s) =>
    s?.status === "cooldown" ? Object.assign(s, { status: "running", runId: newRunId(), message: null, resumeAt: null }) : undefined,
  );
  if (scan?.status === "running") await openScanTab(scan);
});

// A scan can't survive a browser restart: its window is gone.
chrome.runtime.onStartup.addListener(() =>
  update((s) =>
    s && ["running", "cooldown"].includes(s.status)
      ? Object.assign(s, { status: "paused", tabId: null, windowId: null, message: "Paused when the browser closed. Continue any time." })
      : undefined,
  ),
);

/* -------------------------------- Badge ----------------------------------- */

const BADGE_COLORS = { running: "#7c3aed", cooldown: "#d97706", paused: "#6b7280", error: "#dc2626", done: "#16a34a" };

function renderBadge(scan) {
  const songs = scan?.items.length ?? 0;
  const text = scan?.status === "error" ? "!" : songs ? (songs > 999 ? `${Math.floor(songs / 1000)}k` : String(songs)) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[scan?.status] ?? "#6b7280" });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) renderBadge(changes[KEY].newValue ?? null);
});
read().then(renderBadge);
