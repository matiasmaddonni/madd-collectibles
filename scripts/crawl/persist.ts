import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import { fetchBuffer } from "./http";
import { isEmpty } from "./normalise";
import type { CandidateImage } from "./sources/types";

// Service-role client. Imports here instead of @/lib/supabase/admin
// because tsx scripts run outside the Next.js path-alias context.
let clientCache: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (clientCache) return clientCache;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  clientCache = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return clientCache;
}

export type FieldProposal = {
  productId: string;
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  source: string;
  sourceUrl: string;
  confidence: number;
  notes?: string | null;
};

export async function proposeField(p: FieldProposal): Promise<void> {
  // Skip writing a noop proposal (currentValue already matches what we'd
  // propose). Defensive — the runner has its own shouldPropose gate but
  // belt-and-suspenders here cheapens duplicate calls.
  if (
    !isEmpty(p.currentValue) &&
    JSON.stringify(p.currentValue) === JSON.stringify(p.proposedValue)
  ) {
    return;
  }
  const admin = adminClient();
  // Upsert by the partial-unique index (product_id, field, source) where
  // status='pending'. If a pending proposal already exists, update it
  // instead of erroring.
  const { data: existing } = await admin
    .from("crawl_proposals")
    .select("id")
    .eq("product_id", p.productId)
    .eq("field", p.field)
    .eq("source", p.source)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("crawl_proposals")
      .update({
        current_value: p.currentValue ?? null,
        proposed_value: p.proposedValue,
        source_url: p.sourceUrl,
        confidence: p.confidence,
        notes: p.notes ?? null,
        fetched_at: new Date().toISOString(),
      })
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("crawl_proposals").insert({
    product_id: p.productId,
    field: p.field,
    current_value: p.currentValue ?? null,
    proposed_value: p.proposedValue,
    source: p.source,
    source_url: p.sourceUrl,
    confidence: p.confidence,
    notes: p.notes ?? null,
  });
  if (error) throw error;
}

const SLUG_RE = /^[a-z0-9-]+$/;
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type ImageProposal = {
  productId: string;
  productSlug: string;
  candidate: CandidateImage;
  source: string;
};

// Downloads the candidate, uploads to Storage, inserts a row in
// product_images with is_primary=false and proposed_by_source=<source>.
// The atomic RPC isn't appropriate here (we want is_primary=false and
// no primary swap), so we insert directly.
export async function proposeImage(p: ImageProposal): Promise<{
  uploaded: boolean;
  reason?: string;
}> {
  const admin = adminClient();

  // Adapter-supplied alt is `${title} NN` and uniquely identifies each
  // candidate inside a source. Skip if a row already exists with the same
  // (product_id, source, alt) — that's an exact re-run of the same
  // candidate, no value in re-uploading.
  if (p.candidate.alt) {
    const { data: existing } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", p.productId)
      .eq("proposed_by_source", p.source)
      .eq("alt", p.candidate.alt)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { uploaded: false, reason: "duplicate (same candidate)" };
    }
  }

  const folder =
    p.productSlug && SLUG_RE.test(p.productSlug) ? p.productSlug : p.productId;
  const downloaded = await fetchBuffer(p.candidate.url);
  if (!downloaded) return { uploaded: false, reason: "fetch failed" };

  const ext =
    EXTENSION_BY_MIME[downloaded.contentType.split(";")[0]!.trim()] ?? "jpg";
  if (downloaded.buffer.length > 15 * 1024 * 1024) {
    return { uploaded: false, reason: "image > 15 MB" };
  }
  if (downloaded.buffer.length < 1024) {
    return { uploaded: false, reason: "image too small" };
  }
  const safeName =
    `${p.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${safeName}`;

  const { error: upErr } = await admin.storage
    .from("product-images")
    .upload(path, downloaded.buffer, {
      cacheControl: "3600",
      contentType: downloaded.contentType,
      upsert: false,
    });
  if (upErr) return { uploaded: false, reason: upErr.message };

  const { data: pub } = admin.storage
    .from("product-images")
    .getPublicUrl(path);

  // Pick a sort_order at the tail so candidate images don't displace
  // existing manual images.
  const { data: maxRow } = await admin
    .from("product_images")
    .select("sort_order")
    .eq("product_id", p.productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const maxSort = (maxRow as Array<{ sort_order: number }> | null)?.[0]
    ?.sort_order ?? -1;

  const { error: insErr } = await admin.from("product_images").insert({
    product_id: p.productId,
    url: pub.publicUrl,
    is_primary: false,
    sort_order: maxSort + 1,
    alt: p.candidate.alt ?? null,
    proposed_by_source: p.source,
  });
  if (insErr) return { uploaded: false, reason: insErr.message };

  return { uploaded: true };
}
