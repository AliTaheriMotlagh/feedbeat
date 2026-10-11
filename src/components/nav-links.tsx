"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/import", label: "Import" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/feed", label: "Feed" },
];

export function NavLinks({ className }: { className?: string }) {
  return <NavList pathname={usePathname()} className={className} />;
}

/** Static render used in the prerendered shell (no active state). */
export function NavLinksFallback() {
  return <NavList pathname="" />;
}

function NavList({ pathname, className }: { pathname: string; className?: string }) {
  return (
    <nav aria-label="Main" className={cn("hidden items-center gap-1 md:flex", className)}>
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar on phones — thumb-reachable primary navigation. */
export function MobileTabBar() {
  return <MobileTabs pathname={usePathname()} />;
}

export function MobileTabBarFallback() {
  return <MobileTabs pathname="" />;
}

function MobileTabs({ pathname }: { pathname: string }) {
  const tabs = [{ href: "/", label: "Home" }, ...LINKS];
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-14 items-center justify-center text-xs font-semibold text-muted-foreground", active && "text-primary")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
