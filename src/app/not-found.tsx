import Link from "next/link";
import { StartCta } from "@/components/start-cta";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-gradient">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">This track skipped</h1>
      <p className="mt-2 text-muted-foreground">We couldn&apos;t find that page. Start something new instead:</p>
      <StartCta size="sm" className="mt-8" />
      <Button variant="ghost" asChild className="mt-2">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
