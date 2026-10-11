# Feedbeat

Turn X (Twitter) posts into ready-to-play playlists for **Spotify, YouTube, Apple Music, SoundCloud, Deezer, TIDAL and Bandcamp**, then discover, follow, like, comment and climb the leaderboard.

**Runs entirely on free tiers.** Users import their own free X archive, which is parsed in the browser, so no paid X API is needed.

## Two ways to get posts

| | X archive import (default, **free**) | Handle scan (optional, **paid**) |
|---|---|---|
| How | User downloads their archive from X, drops the `.zip` on `/import` | Anyone types any public handle |
| Where it runs | **In the user's browser**: zip opened locally, only music links uploaded | Server, via the X API |
| History | Everything since the account was created | Latest ≤ 3,200 posts |
| Cost | $0 | X API pay-per-use (about $0.005 per post read since Feb 2026) |
| Enable | Always on | Set `X_BEARER_TOKEN` |

Archives can be faked, so an archive profile is marked **"Published by the account owner"** only when the uploader has linked that same X account. Otherwise it shows "From an X archive". Only the original uploader or the verified owner can update it, and an archive can never be merged into a profile with a different X account id.

## Features

- **Private, client-side archive import.** A dependency-free ZIP64 reader opens multi-GB archives in the browser and reads only `tweets.js`, `account.js` and `profile.js`. It previews the songs found before anything is uploaded, then publishes in chunks sized for free-tier function limits. Re-imports only add new songs.
- **Optional handle scanning (X API).** Reads up to 3,200 recent posts (including reposts, quotes and long posts), resolves short links, detects music links, enriches them with titles, artists and artwork, and builds one playlist per platform. Re-scans are incremental (`since_id`).
- **Playlist pages.** Track list plus a "facade" player: the third-party iframe loads only after the visitor presses play. Includes Shuffle, Previous/Next, "Save to Spotify" (OAuth) and "Play all on YouTube" (no login).
- **Social.** Sign in with GitHub or Google (free; X is optional), follow profiles, like and comment on playlists, a personal feed, a community activity stream and curator profiles.
- **Gamification.** XP ledger (idempotent and farm-proof), levels from *Listener* to *Legend*, daily streaks, 10 badges, weekly and all-time leaderboards. The first person to scan a profile is credited as its discoverer.
- **SEO and marketing.** Per-page metadata and canonicals, dynamic Open Graph images, JSON-LD (WebSite + SearchAction, Organization, FAQPage, ProfilePage, MusicPlaylist, BreadcrumbList), dynamic `sitemap.xml`, `robots.txt`, web manifest, share-to-X with XP rewards, and a landing page with live stats, how-it-works, FAQ and CTAs.
- **UX.** Dark and light themes, skeleton loading states, optimistic UI, toasts, a mobile bottom tab bar, a skip link, ARIA labels, `prefers-reduced-motion` support, and a sign-in prompt that explains what users gain.
- **Production.** Next.js 16 Cache Components and Partial Prerendering (static shells on the CDN, dynamic parts streamed), security headers and CSP, rate limiting (Upstash), a Vercel Cron that refreshes popular profiles, Vercel Analytics and Speed Insights, typed environment variables, and unit tests.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Cache Components, PPR), React 19, TypeScript |
| Styling | Tailwind CSS v4, Radix primitives, lucide icons, simple-icons |
| Data | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Better Auth (GitHub, Google, optional X; Spotify linking) |
| Infra | Vercel (Fluid compute, Cron, Analytics), Upstash Redis |
| Quality | ESLint, Vitest, Zod |

## Local development

```bash
cp .env.example .env.local        # set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d              # local Postgres → DATABASE_URL=postgres://postgres:postgres@localhost:5432/feedbeat
npm install
npm run db:migrate
npm run dev
```

Sign-in needs at least one provider (for example a GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github`). If `X_BEARER_TOKEN` is not set, handle scanning in development uses **deterministic demo timelines**. Archive import always works.

```bash
npm test          # unit tests (link parser, archive + zip reader, levels, streaks, badges)
npm run lint
npm run typecheck
npm run build
```

## Free hosting (about 10 minutes, $0)

| Piece | Free service | Notes |
|---|---|---|
| App | **Vercel Hobby** | Free for personal, non-commercial projects. Functions up to 300 s; cron runs once a day. |
| Database | **Neon** (Vercel Marketplace) | Free plan includes 0.5 GB, enough for millions of tracks. |
| Sign-in | **GitHub** and/or **Google** OAuth | Both free. |
| Rate limiting | **Upstash Redis** (optional) | Free tier. Without it, limits are kept in memory per instance. |
| Music data | Spotify / YouTube / SoundCloud / Deezer / iTunes public endpoints | Free, no keys. |
| X data | **User's own X archive** | Free. No X API key. |

1. Push this repo to GitHub, then on vercel.com choose **Add New → Project** and import it (Hobby plan).
2. In the project, open **Storage** and add **Neon**. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Upstash is optional.
3. Create a **GitHub OAuth App** (github.com/settings/developers):
   - Homepage URL: `https://YOUR-APP.vercel.app`
   - Callback: `https://YOUR-APP.vercel.app/api/auth/callback/github`

   Optionally add **Google** too (console.cloud.google.com, OAuth client, redirect `…/api/auth/callback/google`).
4. Add environment variables:
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`)
   - `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` (`https://YOUR-APP.vercel.app`)
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and/or the Google pair
   - `CRON_SECRET` (any random string)
5. Deploy. `vercel-build` runs the database migrations, then `next build`.
6. Optional: submit `/sitemap.xml` to Google Search Console (`GOOGLE_SITE_VERIFICATION`).

Leave `X_BEARER_TOKEN`, `X_CLIENT_ID` and `X_CLIENT_SECRET` empty to stay at $0. The site automatically switches to archive import everywhere.

### Going commercial later

Vercel Hobby doesn't allow commercial use. If you monetize, move to Vercel Pro, or deploy the same Next.js app to another host with a free tier.

### Optional paid add-ons

- **X API** (`X_BEARER_TOKEN`): lets anyone scan any public handle, and keeps popular profiles fresh with the daily cron. Each scan costs about `SCAN_MAX_TWEETS` × $0.005, so lower `SCAN_MAX_TWEETS` and the rate limits in `src/app/api/scan/route.ts` to control spend. "Sign in with X" (`X_CLIENT_ID`/`X_CLIENT_SECRET`) also uses paid API calls, but it's what marks archive profiles as owner-verified.
- **Spotify export** (`SPOTIFY_CLIENT_ID`/`SECRET`): free, but new Spotify apps only work for allow-listed users until Spotify grants extended quota.

## Project layout

```
src/
  app/                 routes (pages, API, OG images, sitemap, robots, manifest)
  components/          UI (player, scan form, social buttons, cards…)
  db/                  Drizzle schema + client
  lib/                 platforms & link parser, gamification rules, auth, site config
  server/              scan pipeline, X client, metadata, queries, cached reads, actions, XP
drizzle/               SQL migrations
```

Key files:

- `src/lib/platforms.ts`: link detection and embed URLs for every platform
- `src/lib/x-archive.ts` and `src/lib/zip-reader.ts`: in-browser archive parsing
- `src/server/archive-import.ts`: validation and ownership rules for imports
- `src/server/scan.ts`: X API scan pipeline (claim → fetch → parse → enrich → store → award XP)
- `src/server/cached.ts`: `use cache` reads that make up the static shells
- `src/lib/gamification.ts`: XP values, levels and badges
