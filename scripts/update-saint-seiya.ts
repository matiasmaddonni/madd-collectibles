/**
 * Enrich Saint Seiya products with name + description from
 * saintseiya.fandom.com/es and release year from tamashiiweb.com.
 *
 * Run:  npx tsx scripts/update-saint-seiya.ts            (dry run)
 *       npx tsx scripts/update-saint-seiya.ts --apply    (writes to Supabase)
 *       npx tsx scripts/update-saint-seiya.ts --slug=marine-steel-cloth
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

// .env.local fallback (dotenv/config loads .env by default)
const envLocal = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const SLUG_FILTER = process.argv
  .find((a) => a.startsWith("--slug="))
  ?.split("=")[1];

// Saint Seiya = these product line slugs
const SAINT_SEIYA_LINE_SLUGS = [
  "myth-cloth",
  "myth-cloth-ex",
  "myth-cloth-ex-metal",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  release_year: number | null;
  product_lines: { slug: string; name: string } | null;
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "es,en;q=0.9" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`fetch failed ${url}: ${(err as Error).message}`);
    return null;
  }
}

// Suffix/variant tokens to strip from product names before searching
const NOISE_TOKENS = [
  "OCE",
  "SOG",
  "GOD CLOTH",
  "REVIVAL",
  "ORIGINAL COLOR EDITION",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "EX",
  "METAL",
];

function cleanQuery(raw: string): string {
  let s = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Strip noise tokens (case-insensitive whole word). Order matters: longest first.
  const sorted = [...NOISE_TOKENS].sort((a, b) => b.length - a.length);
  for (const tok of sorted) {
    const re = new RegExp(`\\b${tok.replace(/\s+/g, "\\s+")}\\b`, "ig");
    s = s.replace(re, " ");
  }

  // Strip parentheticals like "(God Cloth)", brackets, version suffixes "v.2"
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\[[^\]]*\]/g, " ");
  s = s.replace(/\bv\.?\s*\d+\b/gi, " ");

  return s.replace(/\s+/g, " ").trim();
}

async function searchFandom(query: string): Promise<string | null> {
  const url =
    "https://saintseiya.fandom.com/es/api.php?action=opensearch&format=json&limit=5&search=" +
    encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as [string, string[], string[], string[]];
    const titles = data[1] ?? [];
    const urls = data[3] ?? [];
    if (titles.length === 0) return null;

    // Prefer a title that shares ≥ 1 token with the query (case/diacritics-insensitive)
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
    const qTokens = norm(query)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);

    for (let i = 0; i < titles.length; i++) {
      const tNorm = norm(titles[i]);
      if (qTokens.some((tok) => tNorm.includes(tok))) return urls[i];
    }
    return urls[0] ?? null;
  } catch {
    return null;
  }
}

function isHatnote(txt: string): boolean {
  return /^(este art[ií]culo trata sobre|para otros usos|para [^.]+,\s*v[ée]ase|para la versi[oó]n)/i.test(
    txt,
  );
}

function cleanParagraph(txt: string): string {
  return txt.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function extractFandomDetail(html: string): {
  name: string | null;
  description: string | null;
} {
  const $ = cheerio.load(html);

  // Name preference: infobox title (cleanest), then page H1 fallback
  const infoboxTitle = $("aside.portable-infobox h2.pi-title")
    .first()
    .text()
    .trim();
  const name =
    infoboxTitle ||
    $("h1.page-header__title").first().text().trim() ||
    $("#firstHeading").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;

  // Description: first real lede <p>. Strategy:
  //   1) If infobox aside exists, walk its next siblings, take first
  //      non-hatnote <p> ≥ 60 chars.
  //   2) Fallback: first non-hatnote <p> in .mw-parser-output not nested
  //      in skip parents.
  const skipParents =
    "aside, .infobox, .portable-infobox, .notice, .hatnote, .dablink, .navbox, .toc, .messagebox, table";

  let description: string | null = null;

  const aside = $("aside.portable-infobox").first();
  if (aside.length > 0) {
    let node = aside[0].nextSibling as any | null;
    while (node && !description) {
      if (node.type === "tag") {
        const $node = $(node);
        const tag = (node as { tagName?: string }).tagName?.toLowerCase();
        if (tag === "p") {
          const txt = cleanParagraph($node.text());
          if (txt.length >= 60 && !isHatnote(txt)) description = txt;
        } else if (tag && /^h[1-6]$/.test(tag)) {
          // Reached next section heading; stop searching (keeps lede only)
          break;
        } else {
          // Look inside wrapper divs for <p> children
          $node.find("p").each((_, el) => {
            if (description) return;
            const $p = $(el);
            if ($p.parents(skipParents).length > 0) return;
            const txt = cleanParagraph($p.text());
            if (txt.length >= 60 && !isHatnote(txt)) description = txt;
          });
        }
      }
      node = (node as { nextSibling?: any } | null)?.nextSibling
        ?? null;
    }
  }

  if (!description) {
    const content = $(".mw-parser-output").first();
    content.find("p").each((_, el) => {
      if (description) return;
      const $p = $(el);
      if ($p.parents(skipParents).length > 0) return;
      const txt = cleanParagraph($p.text());
      if (txt.length < 60) return;
      if (isHatnote(txt)) return;
      description = txt;
    });
  }

  return { name: name && name.length > 0 ? name : null, description };
}

async function fetchFandom(rawQuery: string): Promise<{
  name: string | null;
  description: string | null;
} | null> {
  const query = cleanQuery(rawQuery);
  const detailUrl = await searchFandom(query);
  if (!detailUrl) return null;
  const html = await fetchHtml(detailUrl);
  if (!html) return null;
  return extractFandomDetail(html);
}

function tamashiiQueryVariants(name: string): string[] {
  const cleaned = cleanQuery(name);
  const variants = new Set<string>([cleaned]);

  // "Moses de Whale" → "Whale Moses"
  const m = cleaned.match(/^(.+?)\s+de\s+(.+)$/i);
  if (m) variants.add(`${m[2]} ${m[1]}`.trim());

  // Also raw original (for cases where token-stripping breaks the match)
  variants.add(name.trim());

  return [...variants];
}

async function findTamashiiProduct(query: string): Promise<string | null> {
  const searchUrl =
    "https://tamashiiweb.com/search?keyword=" + encodeURIComponent(query);
  const searchHtml = await fetchHtml(searchUrl);
  if (!searchHtml) return null;

  const $s = cheerio.load(searchHtml);
  let productHref: string | null = null;
  $s("a").each((_, el) => {
    const href = $s(el).attr("href") || "";
    if (productHref) return;
    if (/\/item(_brand)?\//i.test(href)) {
      productHref = href.startsWith("http")
        ? href
        : "https://tamashiiweb.com" + href;
    }
  });
  return productHref;
}

async function fetchTamashiiYear(query: string): Promise<number | null> {
  let productHref: string | null = null;
  for (const v of tamashiiQueryVariants(query)) {
    productHref = await findTamashiiProduct(v);
    if (productHref) break;
    await sleep(300);
  }
  if (!productHref) return null;

  const productHtml = await fetchHtml(productHref);
  if (!productHtml) return null;

  const $ = cheerio.load(productHtml);

  // Find a table row whose label cell says "Release Date" (or the JP equivalent),
  // then extract the year from the value cell.
  const labelMatchers = [/release\s*date/i, /発売日/];

  let releaseText: string | null = null;
  $("tr").each((_, el) => {
    if (releaseText) return;
    const cells = $(el).find("th, td");
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim();
    if (labelMatchers.some((re) => re.test(label))) {
      releaseText = $(cells[cells.length - 1]).text().trim();
    }
  });

  // Definition list fallback (<dt>Release Date</dt><dd>July 2024</dd>)
  if (!releaseText) {
    $("dt").each((_, el) => {
      if (releaseText) return;
      const label = $(el).text().trim();
      if (labelMatchers.some((re) => re.test(label))) {
        releaseText = $(el).next("dd").text().trim();
      }
    });
  }

  if (!releaseText) return null;
  const m = (releaseText as string).match(/(19|20)\d{2}/);
  if (!m) return null;
  const yr = Number(m[0]);
  if (yr < 1990 || yr > 2100) return null;
  return yr;
}

async function loadProducts(): Promise<ProductRow[]> {
  let q = supabase
    .from("products")
    .select(
      "id, slug, name, description, release_year, product_lines!inner(slug, name)",
    )
    .in("product_lines.slug", SAINT_SEIYA_LINE_SLUGS)
    .order("name", { ascending: true });

  if (SLUG_FILTER) q = q.eq("slug", SLUG_FILTER);

  const { data, error } = await q;
  if (error) {
    console.error("load failed", error);
    process.exit(1);
  }
  return (data ?? []) as unknown as ProductRow[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(product: ProductRow) {
  const tag = `[${product.slug}]`;
  console.log(`\n${tag} current name="${product.name}"`);

  const fandom = await fetchFandom(product.name);
  if (!fandom || (!fandom.name && !fandom.description)) {
    console.log(`${tag}  fandom: no match — skipping`);
    return;
  }
  console.log(`${tag}  fandom name="${fandom.name ?? "(none)"}"`);
  console.log(
    `${tag}  fandom desc="${(fandom.description ?? "").slice(0, 120)}..."`,
  );

  const year = await fetchTamashiiYear(product.name);
  console.log(`${tag}  tamashii year=${year ?? "(none)"}`);

  const update: Record<string, unknown> = {};
  if (fandom.name && fandom.name !== product.name) update.name = fandom.name;
  if (fandom.description && fandom.description !== product.description) {
    update.description = fandom.description;
  }
  if (year && year !== product.release_year) update.release_year = year;

  if (Object.keys(update).length === 0) {
    console.log(`${tag}  no changes`);
    return;
  }

  console.log(`${tag}  patch:`, update);

  if (!APPLY) {
    console.log(`${tag}  (dry run — pass --apply to write)`);
    return;
  }

  const { error } = await supabase
    .from("products")
    .update(update)
    .eq("id", product.id);
  if (error) {
    console.error(`${tag}  update failed`, error);
  } else {
    console.log(`${tag}  ✓ updated`);
  }
}

async function main() {
  const products = await loadProducts();
  console.log(
    `Loaded ${products.length} Saint Seiya product(s)${
      SLUG_FILTER ? ` (filtered by slug=${SLUG_FILTER})` : ""
    }`,
  );
  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN");

  for (const p of products) {
    try {
      await processOne(p);
    } catch (err) {
      console.error(`[${p.slug}] error:`, err);
    }
    await sleep(800); // be polite to wikis
  }

  console.log("\ndone.");
}

main();
