import type { Thing, WithContext } from "schema-dts";

/** Structured data for rich results. `<` is escaped to prevent script injection. */
export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> | WithContext<T>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
