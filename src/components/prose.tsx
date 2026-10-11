import { cn } from "@/lib/utils";

/** Typography for long-form pages (no plugin needed). */
export function Prose({ className, ...props }: React.ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "mx-auto max-w-3xl px-4 py-12 sm:px-6",
        "[&_h1]:font-display [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:tracking-tight",
        "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold",
        "[&_p]:mt-4 [&_p]:leading-7 [&_p]:text-muted-foreground [&_li]:mt-2 [&_li]:text-muted-foreground",
        "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
        className,
      )}
      {...props}
    />
  );
}
