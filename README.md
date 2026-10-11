# Feedbeat

Turn any X (Twitter) account into ready-to-play playlists for **Spotify, YouTube, Apple Music, SoundCloud, Deezer, TIDAL and Bandcamp**, then discover, follow, like, comment and climb the leaderboard.

## Features

- **Scan any public X profile.** Reads up to 3,200 recent posts (including reposts, quotes and long posts), resolves short links, detects music links, enriches them with titles, artists and artwork, and builds one playlist per platform. Re-scans are incremental (`since_id`).
- **Playlist pages.** Track list plus a "facade" player: the third-party iframe loads only after the visitor presses play. Includes Shuffle, Previous/Next, "Save to Spotify" (OAuth) and "Play all on YouTube" (no login).
- **Social.** Sign in with X, follow profiles, like and comment on playlists, a personal feed, a community activity stream and curator profiles.
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
| Auth | Better Auth (X OAuth 2.0; Spotify linking) |
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

If `X_BEARER_TOKEN` is not set, development uses **deterministic demo timelines**, so you can try the whole flow without X API access. Sign-in needs `X_CLIENT_ID` and `X_CLIENT_SECRET`.

```bash
npm test          # unit tests (link parser, levels, streaks, badges)
npm run lint
npm run typecheck
npm run build
```

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. **Storage → Marketplace**: add **Neon** (sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`) and **Upstash Redis** (sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`).
3. Add environment variables (see `.env.example`):
   - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` (your production URL)
   - `X_BEARER_TOKEN`, `X_CLIENT_ID`, `X_CLIENT_SECRET` from the [X developer portal](https://developer.x.com). In the app's OAuth 2.0 settings, set the callback to `https://YOUR_DOMAIN/api/auth/callback/twitter`.
   - Optional: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the [Spotify dashboard](https://developer.spotify.com/dashboard), with redirect URI `https://YOUR_DOMAIN/api/auth/callback/spotify`
   - `CRON_SECRET` (any random string)
4. Deploy. The `vercel-build` script runs database migrations before `next build`.
5. Submit `https://YOUR_DOMAIN/sitemap.xml` in Google Search Console (`GOOGLE_SITE_VERIFICATION` adds the meta tag).

### Costs and limits

- **X API**: each scan costs about `SCAN_MAX_TWEETS / 100` timeline requests, plus 1 user lookup. Refreshes only fetch new posts. Tune `SCAN_MAX_TWEETS` and the rate limits in `src/app/api/scan/route.ts` to fit your X plan.
- **Spotify**: apps start in development mode, limited to allow-listed users. Request extended quota before opening "Save to Spotify" to everyone.

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
- `src/server/scan.ts`: scan pipeline (claim → fetch → parse → enrich → store → award XP)
- `src/server/cached.ts`: `use cache` reads that make up the static shells
- `src/lib/gamification.ts`: XP values, levels and badges
