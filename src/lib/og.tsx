import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** Fetch a remote image as a data URL for Satori; returns null on any failure. */
export async function imageData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/image\/(jpeg|png|gif)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function ogCard({
  eyebrow,
  title,
  subtitle,
  image,
  accent = "#8b5cf6",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  image?: string | null;
  accent?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: `radial-gradient(circle at 15% 10%, ${accent}55, transparent 55%), radial-gradient(circle at 90% 90%, #22d3ee44, transparent 50%), #16141c`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 5,
              width: 56,
              height: 56,
              padding: 12,
              borderRadius: 16,
              background: "linear-gradient(135deg,#d946ef,#8b5cf6,#22d3ee)",
            }}
          >
            {[0.55, 1, 0.75].map((h, i) => (
              <div key={i} style={{ width: 8, height: `${h * 100}%`, borderRadius: 4, background: "white" }} />
            ))}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{site.name}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori
            <img src={image} width={260} height={260} style={{ borderRadius: 32, objectFit: "cover" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 30, color: accent === "#00FFFF" ? "#67e8f9" : accent, fontWeight: 700 }}>{eyebrow}</div>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, marginTop: 12, letterSpacing: -2 }}>{title}</div>
            <div style={{ fontSize: 30, color: "#c4c1d4", marginTop: 20 }}>{subtitle}</div>
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#9893ad" }}>{site.url.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    OG_SIZE,
  );
}
