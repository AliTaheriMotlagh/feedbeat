import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Third-party players we embed (loaded only after the visitor presses play).
const FRAME_SRC = [
  "https://open.spotify.com",
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://embed.music.apple.com",
  "https://w.soundcloud.com",
  "https://widget.deezer.com",
  "https://embed.tidal.com",
  "https://audiomack.com",
  "https://player-widget.mixcloud.com",
  "https://www.mixcloud.com",
  // The Feedbeat Collector extension scans the visitor's own X posts in a frame on /import/extension.
  "https://x.com",
];

// Nonce-free CSP keeps pages prerenderable (Partial Prerendering) while still
// blocking third-party scripts, plugins, framing of our site and form hijacking.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  `frame-src ${FRAME_SRC.join(" ")}`,
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://x.com https://twitter.com https://accounts.spotify.com",
  "frame-ancestors 'none'",
  // Not in dev: it would turn http://192.168.x.x/_next/… into https:// requests the dev server can't answer, so a phone on the same Wi-Fi gets a page that never loads its scripts. (localhost is exempt, which hides this on your own machine.)
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Dev only. Next blocks its dev channel (HMR) for any host but "localhost", and then the page loads but never hydrates.
  // This lets 127.0.0.1 and a phone on the same Wi-Fi (the "Network" URL `next dev` prints) through.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Friendly aliases: /@handle and /x/handle → /u/handle
      { source: "/@:handle", destination: "/u/:handle", permanent: true },
      { source: "/x/:handle", destination: "/u/:handle", permanent: true },
    ];
  },
};

export default nextConfig;
