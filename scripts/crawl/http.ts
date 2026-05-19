// Lightweight fetch wrapper. Adds a friendly User-Agent so target sites
// don't block us as a bare-bones bot, retries transient failures, and
// enforces a polite delay between hits to the same host.

const UA_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://madd-collectibles.vercel.app";
const USER_AGENT = `MaddCollectiblesCrawler/0.1 (+${UA_SITE_URL})`;

// Sites that aggressively block non-browser UAs (eBay's /sch/ listings,
// some CDN edges) need a browser-like UA. Adapters opt in via
// `browserLike: true` on the fetch call.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const lastHitAt = new Map<string, number>();
const POLITE_DELAY_MS = 800;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function paceFor(url: string): Promise<void> {
  const host = new URL(url).host;
  const last = lastHitAt.get(host) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < POLITE_DELAY_MS) await sleep(POLITE_DELAY_MS - elapsed);
  lastHitAt.set(host, Date.now());
}

export type FetchOptions = RequestInit & {
  retries?: number;
  acceptText?: boolean;
  browserLike?: boolean;
};

export async function politeFetch(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    await paceFor(url);
    try {
      const browser = opts.browserLike === true;
      const res = await fetch(url, {
        ...opts,
        headers: {
          "user-agent": browser ? BROWSER_USER_AGENT : USER_AGENT,
          accept: opts.acceptText
            ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            : "application/json, */*;q=0.5",
          ...(browser
            ? {
                "accept-language": "en-US,en;q=0.9",
                "sec-fetch-site": "none",
                "sec-fetch-mode": "navigate",
                "sec-fetch-user": "?1",
                "sec-fetch-dest": "document",
                "upgrade-insecure-requests": "1",
              }
            : {}),
          ...(opts.headers ?? {}),
        },
      });
      // 5xx + 429 + 403 are retryable. Cloudflare/Fandom flakes on a
      // small percentage of requests with 403 (intermittent bot
      // challenge); a short backoff + retry clears it.
      if (res.status >= 500 || res.status === 429 || res.status === 403) {
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt < retries - 1) {
          console.warn(
            `politeFetch retry: ${res.status} on ${new URL(url).host} attempt ${attempt + 1}/${retries}`,
          );
        }
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError ?? new Error("politeFetch: exhausted retries");
}

export async function fetchText(
  url: string,
  opts: FetchOptions = {},
): Promise<string | null> {
  const res = await politeFetch(url, { ...opts, acceptText: true });
  if (!res.ok) return null;
  return await res.text();
}

export async function fetchJson<T>(
  url: string,
  init?: FetchOptions,
): Promise<T | null> {
  const res = await politeFetch(url, init);
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBuffer(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const res = await politeFetch(url);
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}
