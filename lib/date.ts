// Short Argentine-format date helper. Used for the "(al D/M, Dólar Blue)"
// label next to ARS conversions on the product detail page. No leading zeros,
// no year — matches how Argentines casually reference recent dates.
export function formatShortDate(d: Date = new Date()): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
