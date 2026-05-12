// Short Argentine-format date helper. Used for the "(al D/M, Dólar Blue)"
// label next to ARS conversions on the product detail page. No leading zeros,
// no year — matches how Argentines casually reference recent dates.
//
// Anchored to America/Argentina/Buenos_Aires regardless of where the renderer
// runs (ISR'd pages are rebuilt on Vercel edge nodes; without an explicit
// timezone the date flips at midnight UTC, not midnight ART).
const TZ = "America/Argentina/Buenos_Aires";

export function formatShortDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? `${d.getDate()}`;
  const month =
    parts.find((p) => p.type === "month")?.value ?? `${d.getMonth() + 1}`;
  return `${day}/${month}`;
}
