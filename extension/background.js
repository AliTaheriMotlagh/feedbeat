/*
 * Service worker. Owns the scan state (the only writer, so commands and
 * progress never race), points the scan at its X page and hands the
 * collected links to the Feedbeat site.
 *
 * A scan runs in one of two places (collect.js does the work, since MV3
 * workers are stopped after a few idle minutes):
 *  - "tab":   the person's X tab (started from the popup, or as a fallback),
 *  - "frame": an X iframe on the Feedbeat import page (started from the site).
 *    X refuses to be framed, so while such a scan runs a session rule lets
 *    x.com load in frames of that one tab only.
 */
importScripts("lib.js");

const L = self.FeedbeatLib;
const KEY = "scan";
const RESUME_ALARM = "feedbeat-resume";
const IMPORT_PATH = "/import/extension";
const FRAME_RULE_ID = 1;
const ACTIVE = ["running", "cooldown"];

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
 * kind:  "continue" — pick up where the scan stopped (older posts),
 *        "new"      — only posts newer than the newest one collected,
 *        "restart"  — forget everything and scan from the top.
 * where: { target: "frame", tabId } — the Feedbeat page's iframe,
 *        { target: "tab", returnTabId? } — the active X tab, or a new one.
 */
async function start(kind, where) {
  const accountId = await currentAccountId();
  if (!accountId) throw new Error("Sign in to X in this browser first, then try again.");

  const tabId = where.target === "frame" ? where.tabId : await pickXTab();
  const scan = await update((prev) => {
    const s = prev && prev.accountId === accountId && kind !== "restart" ? prev : L.newScan(accountId);
    const resumable = s.mode === "new" && ["paused", "cooldown", "error"].includes(s.status);
    if (kind === "new" && s.newest) {
      Object.assign(s, { mode: "new", since: L.dayOf(s.newest), until: null });
    } else if (!resumable) {
      // A finished history only has newer posts left to find.
      if (s.complete && s.newest) Object.assign(s, { mode: "new", since: L.dayOf(s.newest), until: null });
      // An unfinished profile pass starts again at the top; a search re-reads the oldest day reached. Posts already seen are skipped.
      else if (s.phase === "profile") Object.assign(s, { mode: "all", since: null, until: null });
      else Object.assign(s, { mode: "all", phase: "search", since: null, until: s.oldest ? L.addDays(L.dayOf(s.oldest), 1) : null });
    }
    return Object.assign(s, {
      status: "running",
      runId: newRunId(),
      message: null,
      resumeAt: null,
      target: where.target,
      tabId,
      attached: false,
      returnTabId: where.returnTabId ?? null,
    });
  });
  await chrome.alarms.clear(RESUME_ALARM);
  await syncFrameRule(scan);
  if (scan.target === "tab") await showTab(scan);
  return L.summarize(scan);
}

/** The X tab in front, or a fresh one. */
async function pickXTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id != null && tab.url?.startsWith(`${L.X_ORIGIN}/`)) return tab.id;
  const created = await chrome.tabs.create({ url: "about:blank", active: true });
  return created.id;
}

/** Load the scan's page in its tab and bring it to the front: X only loads posts on screen. */
async function showTab(scan) {
  const tab = await chrome.tabs.update(scan.tabId, { url: L.scanUrl(scan), active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

/** Let x.com load inside the Feedbeat tab's iframe while a frame scan is on. */
async function syncFrameRule(scan) {
  const tabId = scan?.target === "frame" && [...ACTIVE, "error"].includes(scan.status) ? scan.tabId : null;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [FRAME_RULE_ID],
    addRules:
      tabId == null
        ? []
        : [
            {
              id: FRAME_RULE_ID,
              priority: 1,
              action: {
                type: "modifyHeaders",
                responseHeaders: [
                  { header: "x-frame-options", operation: "remove" },
                  { header: "content-security-policy", operation: "remove" },
                ],
              },
              condition: { tabIds: [tabId], requestDomains: ["x.com"], resourceTypes: ["sub_frame"] },
            },
          ],
  });
}

async function pause() {
  const scan = await update((s) =>
    s && ACTIVE.includes(s.status) ? Object.assign(s, { status: "paused", message: null, resumeAt: null }) : undefined,
  );
  await chrome.alarms.clear(RESUME_ALARM);
  await syncFrameRule(scan);
  return L.summarize(scan);
}

async function reset() {
  await chrome.alarms.clear(RESUME_ALARM);
  await update(() => null);
  await syncFrameRule(null);
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

/* ---------------------------- Collector (X page) -------------------------- */

/** Is this X page the one the scan runs in? */
function isTarget(scan, sender) {
  if (sender.tab?.id !== scan.tabId) return false;
  return scan.target === "frame" ? sender.frameId > 0 : sender.frameId === 0;
}

/** Every X page asks on load whether it should be scanning. */
async function whoami(sender) {
  const scan = await read();
  if (!scan || scan.status !== "running" || !isTarget(scan, sender)) return { run: false };
  if (!scan.attached) await update((s) => (s?.runId === scan.runId ? Object.assign(s, { attached: true }) : undefined));
  const { runId, accountId, handle, mode, phase, since, until, newest, seen, target } = scan;
  return { run: true, scan: { runId, accountId, handle, mode, phase, since, until, newest, seen, inFrame: target === "frame" } };
}

/** Progress from the X page. Returns stop: true once the scan was paused or replaced. */
async function progress(sender, patch) {
  let finished = null;
  const scan = await update((s) => {
    if (!s || s.runId !== patch.runId || s.status !== "running" || !isTarget(s, sender)) return undefined;
    if (patch.handle && !s.handle) s.handle = patch.handle;
    if (patch.profile?.username?.toLowerCase() === s.handle?.toLowerCase()) s.profile = patch.profile;
    if (patch.tweets?.length) L.mergeTweets(s, patch.tweets);
    if ("until" in patch) s.until = patch.until;
    if (patch.phase) s.phase = patch.phase;
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
  await syncFrameRule(scan);
  if (scan.status === "cooldown") await chrome.alarms.create(RESUME_ALARM, { when: scan.resumeAt });
  // A tab scan ends with Feedbeat in front, ready to publish. A frame scan is already there.
  if (scan.status !== "done" || scan.target !== "tab") return;
  const back = scan.returnTabId != null ? await chrome.tabs.get(scan.returnTabId).catch(() => null) : null;
  if (back) {
    await chrome.tabs.update(back.id, { active: true });
    await chrome.windows.update(back.windowId, { focused: true });
  } else {
    // ?publish: the page imports the songs as soon as it opens.
    await chrome.tabs.create({ url: `${L.SITE_URL}${IMPORT_PATH}?publish` });
  }
}

/* ------------------------------- Messaging -------------------------------- */

const isSite = (sender) => {
  try {
    return sender.frameId === 0 && L.SITE_ORIGINS.includes(new URL(sender.url).origin);
  } catch {
    return false;
  }
};
const isPopup = (sender) => sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) ?? false;
const isX = (sender) => sender.tab != null && sender.url?.startsWith(`${L.X_ORIGIN}/`);

/** Site: scan in this page's iframe, or in a new tab when asked. Popup: the X tab in front. */
function whereFor(payload, sender) {
  if (!isSite(sender)) return { target: "tab" };
  return payload?.target === "tab" ? { target: "tab", returnTabId: sender.tab.id } : { target: "frame", tabId: sender.tab.id };
}

const HANDLERS = {
  "feedbeat:get": {
    from: [isSite, isPopup],
    run: async (_p, s) => ({ state: L.summarize(await read()), signedIn: (await currentAccountId()) !== null, tabId: s.tab?.id ?? null }),
  },
  "feedbeat:start": { from: [isSite, isPopup], run: async (p, s) => ({ state: await start(p?.kind ?? "continue", whereFor(p, s)) }) },
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
  "feedbeat:whoami": { from: [isX], run: (_p, s) => whoami(s) },
  "feedbeat:progress": { from: [isX], run: (p, s) => progress(s, p) },
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
  if (scan?.tabId !== tabId || !ACTIVE.includes(scan.status)) return;
  const next = await update((s) => Object.assign(s, { status: "paused", message: "The tab was closed. Continue any time; progress is saved." }));
  await chrome.alarms.clear(RESUME_ALARM);
  await syncFrameRule(next);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RESUME_ALARM) return;
  const scan = await update((s) =>
    s?.status === "cooldown" ? Object.assign(s, { status: "running", runId: newRunId(), message: null, resumeAt: null, attached: false }) : undefined,
  );
  // A frame scan restarts when the page sees the new run; a tab scan is reloaded here.
  if (scan?.status === "running" && scan.target === "tab") await showTab(scan).catch(() => pause());
});

// A scan can't survive a browser restart: its page is gone.
chrome.runtime.onStartup.addListener(async () => {
  const scan = await update((s) =>
    s && ACTIVE.includes(s.status) ? Object.assign(s, { status: "paused", message: "Paused when the browser closed. Continue any time." }) : undefined,
  );
  await syncFrameRule(scan);
});

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
