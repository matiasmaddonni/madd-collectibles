import { fetchJson, politeFetch } from "../http";
import { optionalEnv } from "../env";
import { stripDiacritics, tokens } from "../normalise";
import type {
  AdapterInput,
  AdapterResult,
  CandidateImage,
  SourceAdapter,
} from "./types";

// eBay Browse API adapter. Requires EBAY_APP_ID + EBAY_CERT_ID. Returns:
//   - photos from current NEW (sealed-box) listings
//   - min / median / max USD across the returned listings (in notes)
//   - median as the proposed `price`
//
// NOTE on sold listings: the Browse API only exposes ACTIVE listings.
// eBay's Marketplace Insights API exposes the sold/completed price
// history but needs a separate access grant ("Buy APIs → Insights"
// scope at https://developer.ebay.com). For now we use Browse only; the
// notes label reflects this so the admin knows the source. The
// /sch/ HTML scrape path is intentionally not used because eBay
// rate-limits non-residential IPs to 403 within a few requests.
//
// Query is composed from line + series + name so generic product names
// (e.g. "Kanon") get disambiguated. Example:
//   storefront slug    geminis-cloth-kanon
//   composed query     "Saint Cloth Myth EX Gemini Kanon"

const TOKEN_ENDPOINT = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_ENDPOINT =
  "https://api.ebay.com/buy/browse/v1/item_summary/search";

// ---------- query composer ----------

const LINE_ALIASES: Record<string, string[]> = {
  "myth-cloth": ["Saint Cloth Myth"],
  "myth-cloth-ex": ["Saint Cloth Myth EX", "Myth Cloth EX"],
  "myth-cloth-ex-metal": ["Saint Cloth Myth EX", "Myth Cloth EX"],
  "sh-figuarts": ["S.H.Figuarts", "SH Figuarts"],
  "figuarts-zero": ["Figuarts Zero"],
  proplica: ["PROPLICA"],
  "imagination-works": ["Imagination Works"],
  "popup-parade": ["Pop Up Parade"],
  "variable-action-heroes": ["Variable Action Heroes"],
};

// Series words that are *redundant* given a line slug. Saint Cloth Myth
// is by definition Saint Seiya merchandise, so repeating "seiya" in the
// eBay query hurts relevance. SH Figuarts spans many franchises, so no
// implied series tokens there.
const LINE_IMPLIED_SERIES_TOKENS: Record<string, string[]> = {
  "myth-cloth": ["seiya"],
  "myth-cloth-ex": ["seiya"],
  "myth-cloth-ex-metal": ["seiya"],
};

function uniqueWords(s: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of stripDiacritics(s).split(/\s+/)) {
    const k = w.toLowerCase();
    if (!w || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

export function buildEbayQuery(input: AdapterInput): string {
  const lineLabel = LINE_ALIASES[input.lineSlug]?.[0] ?? input.lineName;
  // Series words to drop: anything already inside the line label, plus
  // anything in the line-specific "implied" list (e.g. Saint Cloth Myth
  // already implies "seiya" so we don't repeat it).
  const skip = new Set<string>([
    ...tokens(lineLabel),
    ...(LINE_IMPLIED_SERIES_TOKENS[input.lineSlug] ?? []),
  ]);
  const seriesTokens = (
    input.seriesName ? tokens(input.seriesName) : []
  ).filter((t) => !skip.has(t));
  const nameTokens = tokens(input.name);
  const composed = [lineLabel, ...seriesTokens, ...nameTokens].join(" ");
  return uniqueWords(composed).join(" ").trim();
}

// ---------- OAuth ----------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const appId = optionalEnv("EBAY_APP_ID");
  const certId = optionalEnv("EBAY_CERT_ID");
  if (!appId || !certId) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });
  const res = await politeFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    console.warn(`eBay token request failed: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

// ---------- Browse API call ----------

type BrowseItem = {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
};
type BrowseResponse = { itemSummaries?: BrowseItem[]; total?: number };

function upgradeEbayImage(src: string): string {
  return src.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, "/s-l1600.$1");
}

function statsFromPrices(values: number[]): {
  min: number;
  median: number;
  max: number;
  count: number;
} | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    median,
    count: sorted.length,
  };
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

async function fetchAdapter(
  input: AdapterInput,
): Promise<AdapterResult | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const q = buildEbayQuery(input);
  if (!q) return null;

  const url =
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}` +
    `&filter=conditions:{NEW}` +
    `&limit=50`;
  const json = await fetchJson<BrowseResponse>(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  if (!json?.itemSummaries || json.itemSummaries.length === 0) return null;
  const items = json.itemSummaries;

  // Stats over up to 25 USD listings (resists outliers, keeps the range
  // representative of the typical sealed-box price).
  const usdPrices = items
    .filter((i) => i.price?.currency === "USD")
    .map((i) => Number(i.price!.value))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 25);
  const stats = statsFromPrices(usdPrices);

  // Images: primary thumb from top 4 distinct listings, upgraded to
  // largest CDN size.
  const seen = new Set<string>();
  const images: CandidateImage[] = [];
  for (const it of items) {
    if (images.length >= 4) break;
    const raw = it.image?.imageUrl ?? it.thumbnailImages?.[0]?.imageUrl;
    if (!raw) continue;
    const hash = raw.match(/\/g\/([^/]+)\//)?.[1] ?? raw;
    if (seen.has(hash)) continue;
    seen.add(hash);
    images.push({
      url: upgradeEbayImage(raw),
      alt: `eBay sealed-box ${String(images.length + 1).padStart(2, "0")}`,
    });
  }

  if (images.length === 0 && !stats) return null;

  const priceFields = stats
    ? { price: Math.ceil(stats.median), currency: "USD" as const }
    : {};
  const notes = stats
    ? {
        price: `Active NEW listings (${stats.count}) — min ${formatUsd(stats.min)} · median ${formatUsd(stats.median)} · max ${formatUsd(stats.max)} · query: "${q}"`,
      }
    : undefined;

  const confidence = Math.min(
    85,
    40 + (stats?.count ?? 0) * 2 + images.length * 4,
  );

  return {
    source: "ebay",
    sourceUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_ItemCondition=1000`,
    fields: priceFields,
    notes,
    images,
    confidence,
  };
}

export const ebayAdapter: SourceAdapter = {
  name: "ebay",
  enabled: () =>
    Boolean(optionalEnv("EBAY_APP_ID") && optionalEnv("EBAY_CERT_ID")),
  fetch: fetchAdapter,
};
