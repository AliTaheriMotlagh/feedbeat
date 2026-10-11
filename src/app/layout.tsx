import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import type { Organization, WebSite } from "schema-dts";
import { AuthPromptProvider } from "@/components/auth-prompt";
import { JsonLd } from "@/components/json-ld";
import { MobileTabBar, MobileTabBarFallback } from "@/components/nav-links";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { features } from "@/env";
import { absoluteUrl, site } from "@/lib/site";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Turn any X profile into Spotify & YouTube playlists`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  category: "music",
  openGraph: {
    type: "website",
    siteName: site.name,
    url: site.url,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: site.twitter,
    creator: site.twitter,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  formatDetection: { telephone: false },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16141c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>
          <AuthPromptProvider providers={features.loginProviders}>
            <SiteHeader />
            <main id="main" className="min-h-[60vh]">
              {children}
            </main>
            <SiteFooter />
            <Suspense fallback={<MobileTabBarFallback />}>
              <MobileTabBar />
            </Suspense>
          </AuthPromptProvider>
        </Providers>
        <JsonLd<WebSite>
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: site.url,
            description: site.description,
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/explore?q={search_term_string}") },
              // @ts-expect-error -- schema.org extension Google uses for sitelinks search
              "query-input": "required name=search_term_string",
            },
          }}
        />
        <JsonLd<Organization>
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: site.name,
            url: site.url,
            logo: absoluteUrl("/logo.svg"),
            sameAs: [`https://x.com/${site.twitter.slice(1)}`],
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
