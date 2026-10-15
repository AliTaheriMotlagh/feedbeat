# Feedbeat Collector (browser extension)

Scans the signed-in user's own X posts for music links and hands them to Feedbeat. Everything is read in the browser; only music links (with post date and text) are uploaded, and only when the user publishes.

## How a scan works

1. Where it runs:
   - **Website:** on `/import/extension`, **Scan my X posts** opens X in a new tab. When the scan is done the site tab comes back to the front and publishes the songs by itself. **Scan inside it** loads X in an iframe on the page instead: X refuses to be framed, so while that scan runs a `declarativeNetRequest` session rule removes X's `X-Frame-Options`/CSP headers for x.com frames **in that one tab only**. Many browsers keep X's sign-in cookies out of frames, so this is the fallback, not the default.
   - **Popup:** **Scan my posts in this tab** uses the X tab in front, or opens one. When it's done, the site opens with `?publish` and publishes.
2. `collect.js` first scrolls the profile timeline (`/<handle>/with_replies`), which lists every post but only the latest ~3,200, while search leaves posts out for some accounts. The pinned post is ignored when tracking dates. Then it searches `from:<handle> filter:links`, latest first, from the oldest day the profile reached. X stops serving a search after a few hundred results, so when a search runs dry it reloads it with `until:<oldest day reached>`, one date window at a time, back to the first post. **Check for new posts** only scrolls the profile until it passes the newest post collected.
3. `hook.js` (page world) copies X's own timeline responses, which carry the full links that the page only shows as `t.co` or truncated. Reading the rendered page is the fallback.
4. Progress goes to the service worker every few seconds, so a scan can be paused, survive a closed window or browser restart, and **continue** from the oldest day reached. When the history is complete, **Check for new posts** scans only posts newer than the newest one collected.
5. If X rate-limits, the scan waits 15 minutes (`chrome.alarms`) and continues by itself.

| File | Runs in | Role |
| --- | --- | --- |
| `background.js` | service worker | Owns the scan state (only writer), opens the X window, badge, hands the batch to the site |
| `collect.js` | x.com tab or frame, isolated world | Scrolls the search, reads posts, reports progress |
| `hook.js` | x.com tab or frame, page world | Forwards X's timeline responses to `collect.js` |
| `bridge.js` | Feedbeat `/import/extension` | Relays the page's commands and pushes live scan state |
| `popup.*` | toolbar popup | Same controls as the site |
| `lib.js` | everywhere | Pure helpers, unit-tested in `src/lib/extension-lib.test.ts` |

## Permissions

- `https://x.com/*`: read the user's own posts while a scan runs. Nothing runs unless a scan was started.
- `cookies`: read X's `twid` cookie to know which account is signed in.
- `storage`, `unlimitedStorage`: keep scan progress so it can continue later.
- `alarms`: resume after X's rate-limit window.
- `declarativeNetRequestWithHostAccess`: let x.com load in the Feedbeat page's iframe, only in the tab running a scan and only while it runs.
- Feedbeat origin: the bridge on `/import/extension`.

## Develop

`chrome://extensions` → Developer mode → **Load unpacked** → this folder. `npm run dev` serves the site on `http://localhost:3000`, which the dev manifest allows.

## Release

1. Bump `version` in `manifest.json`.
2. `npm run ext:pack` → `extension-dist/feedbeat-collector-<version>.zip`. It removes the localhost entries from the manifest.
3. Upload the zip to the Chrome Web Store, then set `NEXT_PUBLIC_EXTENSION_URL` to the listing so `/import/extension` links to it.

Icons are generated from the logo with `npm run ext:icons`.
