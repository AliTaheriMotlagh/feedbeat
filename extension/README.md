# Feedbeat Collector (browser extension)

Scans the signed-in user's own X posts for music links and hands them to Feedbeat. Everything is read in the browser; only music links (with post date and text) are uploaded, and only when the user publishes.

## How a scan works

1. The user presses **Start** on `/import/extension` (or in the popup). The service worker opens a small X window.
2. `collect.js` searches `from:<handle> filter:links`, latest first. X stops serving a search after a few hundred results, so when a search runs dry it reloads it with `until:<oldest day reached>`, one date window at a time, back to the first post.
3. `hook.js` (page world) copies X's own timeline responses, which carry the full links that the page only shows as `t.co` or truncated. Reading the rendered page is the fallback.
4. Progress goes to the service worker every few seconds, so a scan can be paused, survive a closed window or browser restart, and **continue** from the oldest day reached. When the history is complete, **Check for new posts** scans only posts newer than the newest one collected.
5. If X rate-limits, the scan waits 15 minutes (`chrome.alarms`) and continues by itself.

| File | Runs in | Role |
| --- | --- | --- |
| `background.js` | service worker | Owns the scan state (only writer), opens the X window, badge, hands the batch to the site |
| `collect.js` | x.com, isolated world | Scrolls the search, reads posts, reports progress |
| `hook.js` | x.com, page world | Forwards X's timeline responses to `collect.js` |
| `bridge.js` | Feedbeat `/import/extension` | Relays the page's commands and pushes live scan state |
| `popup.*` | toolbar popup | Same controls as the site |
| `lib.js` | everywhere | Pure helpers, unit-tested in `src/lib/extension-lib.test.ts` |

## Permissions

- `https://x.com/*`: read the user's own posts while a scan runs. Nothing runs unless a scan was started.
- `cookies`: read X's `twid` cookie to know which account is signed in.
- `storage`, `unlimitedStorage`: keep scan progress so it can continue later.
- `alarms`: resume after X's rate-limit window.
- Feedbeat origin: the bridge on `/import/extension`.

## Develop

`chrome://extensions` → Developer mode → **Load unpacked** → this folder. `npm run dev` serves the site on `http://localhost:3000`, which the dev manifest allows.

## Release

1. Bump `version` in `manifest.json`.
2. `npm run ext:pack` → `extension-dist/feedbeat-collector-<version>.zip`. It removes the localhost entries from the manifest.
3. Upload the zip to the Chrome Web Store, then set `NEXT_PUBLIC_EXTENSION_URL` to the listing so `/import/extension` links to it.

Icons are generated from the logo with `npm run ext:icons`.
