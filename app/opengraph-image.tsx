import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/env";

// Site-wide social-share fallback. Per-page metadata (e.g. product
// detail) overrides this. Next picks it up automatically from this path
// thanks to the App Router file-system convention.

export const runtime = "edge";

// Host displayed in the bottom strip — derived from the canonical
// SITE_URL so domain changes flow through automatically.
const siteHost = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "madd-collectibles.vercel.app";
  }
})();
export const alt = "MADD. — Coleccionables Bandai en Argentina";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori (the engine behind ImageResponse) requires every multi-child div
// to declare display: flex. Single-child divs and pure text nodes are
// fine. Layout uses nested flex stacks instead of inline text + br.

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(120% 80% at 85% 25%, rgba(192, 57, 43, 0.28), transparent 60%), radial-gradient(80% 50% at 10% 100%, rgba(218, 165, 32, 0.08), transparent 65%), linear-gradient(180deg, #14141a 0%, #0a0a0e 100%)",
          color: "#f0ede8",
          fontFamily: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
        }}
      >
        {/* Wordmark row */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          <div style={{ display: "flex" }}>MADD</div>
          <div style={{ display: "flex", color: "#C0392B", fontWeight: 800 }}>
            .
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#8a8680",
              marginLeft: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Coleccionables
          </div>
        </div>

        {/* Tagline block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1,
              maxWidth: 1000,
            }}
          >
            <div style={{ display: "flex" }}>CADA COLECCIÓN</div>
            <div style={{ display: "flex", gap: 22 }}>
              <div style={{ display: "flex" }}>TIENE SU</div>
              <div style={{ display: "flex", color: "#C0392B" }}>HISTORIA.</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#b9bcc2",
              letterSpacing: 0.5,
              maxWidth: 1000,
            }}
          >
            Myth Cloth EX · S.H.Figuarts · Figuarts Zero · Pop Up Parade
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 20,
            color: "#8a8680",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontFamily: 'ui-monospace, "SF Mono", monospace',
          }}
        >
          <div style={{ display: "flex" }}>{siteHost}</div>
          <div style={{ display: "flex" }}>
            De coleccionista a coleccionista
          </div>
        </div>
      </div>
    ),
    size,
  );
}
