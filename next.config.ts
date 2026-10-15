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
  "upgrade-insecure-requests",
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
