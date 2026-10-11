import Link from "next/link";
import { Search } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "./logo";
import { NavLinks, NavLinksFallback } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/explore"
            aria-label="Search profiles"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <Search className="size-4" />
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
