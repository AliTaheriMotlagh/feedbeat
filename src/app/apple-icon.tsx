import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 14,
          padding: 40,
          background: "linear-gradient(135deg,#d946ef,#8b5cf6,#22d3ee)",
        }}
      >
        {[0.55, 1, 0.75].map((h, i) => (
          <div key={i} style={{ width: 22, height: `${h * 100}%`, borderRadius: 11, background: "white" }} />
        ))}
      </div>
    ),
    size,
  );
}
