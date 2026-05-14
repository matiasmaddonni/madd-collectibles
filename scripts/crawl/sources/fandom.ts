import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "../http";
import { searchQuery, similarity } from "../normalise";
import type { AdapterInput, AdapterResult, SourceAdapter } from "./types";

// Fandom wikis. Lookup is series-first, then line-fallback. We hit the
// MediaWiki opensearch API, parse the chosen article for the lede.
//
// Why series-first: lines like `sh-figuarts` host many franchises
// (Dragon Ball, Jujutsu Kaisen, Chainsaw Man, …). Keying on line alone
// leaks Chainsaw Man queries into the Dragon Ball wiki and returns
// nonsense matches. Series name is line-agnostic so we map directly:
// "Chainsaw Man" → chainsawman.fandom.com regardless of line.
type WikiTarget = { host: string; lang: string };

// Series name (lower-cased) → wiki target. `lang: "es"` requests the
// /es path of a single global wiki; not every fandom has one, so we
// always retry with the default lang if the Spanish search returns
// empty (handled in `search()`).
const WIKI_BY_SERIES: Record<string, WikiTarget> = {
  "saint seiya": { host: "saintseiya.fandom.com", lang: "es" },
  "dragon ball z": { host: "dragonball.fandom.com", lang: "es" },
  "dragon ball gt": { host: "dragonball.fandom.com", lang: "es" },
  "dragon ball super": { host: "dragonball.fandom.com", lang: "es" },
  "dragon ball super: super hero": { host: "dragonball.fandom.com", lang: "es" },
  "dragon ball super: broly": { host: "dragonball.fandom.com", lang: "es" },
  "jujutsu kaisen": { host: "jujutsu-kaisen.fandom.com", lang: "es" },
  "one piece": { host: "onepiece.fandom.com", lang: "es" },
  "chainsaw man": { host: "chainsaw-man.fandom.com", lang: "es" },
  naruto: { host: "naruto.fandom.com", lang: "es" },
  bleach: { host: "bleach.fandom.com", lang: "es" },
  "demon slayer": { host: "kimetsu-no-yaiba.fandom.com", lang: "es" },
  "spy × family": { host: "spy-x-family.fandom.com", lang: "es" },
  "my hero academia": { host: "bokunoheroacademia.fandom.com", lang: "es" },
};

// Line fallback for legacy products without a series_id. Only the Saint
// Seiya lines have a safe default — everything else stays empty so we
// don't pollute results with wrong-wiki matches.
const WIKI_BY_LINE: Record<string, WikiTarget> = {
  "myth-cloth": { host: "saintseiya.fandom.com", lang: "es" },
  "myth-cloth-ex": { host: "saintseiya.fandom.com", lang: "es" },
  "myth-cloth-ex-metal": { host: "saintseiya.fandom.com", lang: "es" },
};

function pickWiki(input: AdapterInput): WikiTarget | null {
  if (input.seriesName) {
    const key = input.seriesName.trim().toLowerCase();
    const hit = WIKI_BY_SERIES[key];
    if (hit) return hit;
  }
  return WIKI_BY_LINE[input.lineSlug] ?? null;
}

type OpenSearchResponse = [string, string[], string[], string[]];

async function searchAtBase(
  base: string,
  query: string,
): Promise<{ title: string; url: string }[]> {
  const url =
    `${base}/api.php?action=opensearch&limit=10&format=json` +
    `&search=${encodeURIComponent(query)}`;
  const json = await fetchJson<OpenSearchResponse>(url);
  if (!json || !Array.isArray(json) || json.length < 4) return [];
  const titles = json[1];
  const urls = json[3];
  return titles.map((t, i) => ({ title: t, url: urls[i]! }));
}

async function search(
  wiki: WikiTarget,
  query: string,
): Promise<{ title: string; url: string }[]> {
  // Try the requested lang first; fall back to the default (no lang
  // prefix) when no results OR when the lang path doesn't exist
  // (returns 404/403, surfaced as a thrown error by politeFetch).
  if (wiki.lang) {
    try {
      const langHits = await searchAtBase(
        `https://${wiki.host}/${wiki.lang}`,
        query,
      );
      if (langHits.length > 0) return langHits;
    } catch {
      // fall through to default-lang
    }
  }
  try {
    return await searchAtBase(`https://${wiki.host}`, query);
  } catch {
    return [];
  }
}

function isHatnote(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith("this article is about") ||
    lower.startsWith("for the") ||
    lower.startsWith("not to be confused") ||
    lower.startsWith("redirected from") ||
    lower.startsWith("directory:") ||
    lower.startsWith("see also") ||
    /^[a-z\s]+→/.test(lower)
  );
}

function cleanParagraph(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// NOTE: Fandom images were intentionally dropped — they are illustrations,
// not real product photos. Tamashii (official) + eBay (sealed-box
// listings) are the image sources. Fandom remains the source for lede /
// description text only.

const SKIP_BLOCKS = new Set([
  "aside",
  "table",
  "figure",
  "style",
  "script",
  "nav",
  "header",
  "footer",
  // Quote / citation templates render their text inside <small> or
  // <blockquote>; skipping them avoids picking the in-universe quote
  // before the real lede.
  "small",
  "blockquote",
  "cite",
]);
const SKIP_CLASS_SELECTOR =
  ".infobox, .portable-infobox, .notice, .hatnote, .dablink, .navbox, .toc, .messagebox, .reference, .references";

function parseLede($: cheerio.CheerioAPI): string | null {
  // Many Fandom articles render the lede as raw text + inline elements
  // (<b>, <i>, <a>, <span>) directly inside `.mw-parser-output`, NOT
  // wrapped in a <p>. We walk top-level children in DOM order. Some
  // articles also start with a tab-nav <div> ("Artículo Principal …
  // Galería") generated by the `{{Partes de Artículo}}` template — we
  // skip everything until we pass the first aside/infobox to avoid
  // picking that nav up as the lede.
  const root = $(".mw-parser-output").first();
  if (root.length === 0) return null;
  const hasInfobox = root.find("aside.portable-infobox, .infobox").length > 0;

  const collected: string[] = [];
  let stopped = false;
  let armed = !hasInfobox; // start collecting once infobox is passed

  root.contents().each((_, node) => {
    if (stopped) return false;
    if (node.type === "text") {
      if (!armed) return;
      const t = (node.data ?? "").replace(/\s+/g, " ");
      if (t.trim()) collected.push(t);
      return;
    }
    if (node.type !== "tag") return;
    const tagName = (node as { tagName?: string }).tagName?.toLowerCase();
    if (!tagName) return;
    const $node = $(node);

    // First section heading ends the lede region.
    if (/^h[1-6]$/.test(tagName)) {
      stopped = true;
      return false;
    }

    // Infobox/aside: arm the collector, then skip its content.
    if (tagName === "aside" || $node.is(".infobox, .portable-infobox")) {
      armed = true;
      return;
    }

    // Skipped containers (asides we missed, navboxes, etc.) — neither
    // include nor stop.
    if (SKIP_BLOCKS.has(tagName)) return;
    if ($node.is(SKIP_CLASS_SELECTOR)) return;

    if (!armed) return;

    // First non-empty <p> ends the lede.
    if (tagName === "p") {
      if ($node.hasClass("mw-empty-elt")) return;
      const ptxt = cleanParagraph($node.text());
      if (!ptxt) return;
      // If we've already collected the unwrapped lede, stop without
      // appending this paragraph.
      if (collected.join(" ").trim().length >= 40) {
        stopped = true;
        return false;
      }
      // No unwrapped lede; this <p> IS the lede.
      collected.push(ptxt);
      stopped = true;
      return false;
    }

    // Inline / div / block-level template wrapper — collect text but do
    // not stop (handles <b>/<i>/<a>/<span> as inline lede markup).
    const text = $node.text().replace(/\s+/g, " ");
    if (text.trim()) collected.push(text);
  });

  // Tighten spacing around punctuation/parentheses introduced by inline-
  // node joins ("Jabu ( 邪武 , Jabu ) (o Jabú …" → "Jabu (邪武, Jabu) (o Jabú …").
  const merged = cleanParagraph(collected.join(""))
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (merged.length < 60 || isHatnote(merged)) return null;
  return merged;
}

async function fetchAdapter(
  input: AdapterInput,
): Promise<AdapterResult | null> {
  const wiki = pickWiki(input);
  if (!wiki) return null;
  const query = searchQuery(input.name);
  if (!query) return null;
  const hits = await search(wiki, query);
  if (hits.length === 0) return null;

  // Pick the closest title by Jaccard similarity.
  let best = hits[0]!;
  let bestScore = similarity(input.name, best.title);
  for (const hit of hits.slice(1)) {
    const s = similarity(input.name, hit.title);
    if (s > bestScore) {
      best = hit;
      bestScore = s;
    }
  }
  if (bestScore < 0.2) return null;

  const html = await fetchText(best.url);
  if (!html) return null;
  const $ = cheerio.load(html);
  const description = parseLede($);
  if (!description) return null;
  // Fan-curated → lower confidence ceiling than first-party Tamashii.
  const confidence = Math.round(35 + Math.min(bestScore, 1) * 25);

  return {
    source: "fandom",
    sourceUrl: best.url,
    fields: { description },
    images: [],
    confidence,
  };
}

export const fandomAdapter: SourceAdapter = {
  name: "fandom",
  enabled: () => true,
  fetch: fetchAdapter,
};
