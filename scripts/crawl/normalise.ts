// Name + token utilities shared by adapters when fuzzy-matching a
// products row to an external search result.

// Tokens that appear in product names but never identify the character.
// Stripped before fuzzy-matching against external sources so "Aiacos de
// Garuda OCE" matches "Aiacos de Garuda" on Fandom etc.
const NOISE_TOKENS = new Set([
  // Brand + line names
  "tamashii",
  "myth",
  "cloth",
  "saint",
  "figuarts",
  "sh",
  "sthsh",
  "popup",
  "parade",
  "bandai",
  "spirits",
  "nation",
  "nations",
  // Version / edition suffixes — added as more variants appear
  "metal",
  "ex",
  "revival",
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
  "edition",
  "version",
  "ver",
  "limited",
  "ed",
  "oce", // Original Color Edition
  "tamashii-original",
  "kakusei",
  "asgard",
  "anniversary",
  "th",
  // Spanish particles that survived the >= 2-char filter but add no
  // identifying signal to a search query.
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "en",
  "por",
  "para",
]);

// Same set with hyphenated/casing variants — used by slug-level matching
// in adapters that key by slug rather than name.
export const SLUG_VERSION_SUFFIXES = [
  "oce",
  "ex",
  "metal",
  "revival",
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
  "anniversary",
];

export function stripVersionSuffix(slug: string): string {
  let s = slug.toLowerCase();
  for (const suffix of SLUG_VERSION_SUFFIXES) {
    s = s.replace(new RegExp(`-${suffix}$`), "");
  }
  return s;
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normaliseName(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normaliseName(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !NOISE_TOKENS.has(t));
}

// Search-friendly version: keep alphanumerics, drop the noise tokens.
export function searchQuery(name: string): string {
  return tokens(name).join(" ");
}

// Jaccard similarity over token sets. Cheap heuristic for picking the
// best result from a search response.
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

export function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "number") return v === 0;
  return false;
}
