import { loadEnv } from "./crawl/env";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Shrink oversized product photos in the product-images bucket so the
// Vercel optimizer pulls fewer bytes from Supabase on each cache miss and
// the bucket stays well under the 1 GB Free storage quota.
//
// For every product_images row whose file is bigger than MIN_BYTES:
//   1. download the original
//   2. resize to fit MAX_EDGE (never upscale), re-encode as JPEG q82
//      (WebP when the source has an alpha channel)
//   3. upload under a NEW key (<old-name>-c.<ext>) with a 1 year
//      Cache-Control, then point the row at the new URL
// Originals are left in place; run prune-orphan-images afterwards to
// remove them once the site looks right. Rows are only rewritten when
// the new file saves at least MIN_SAVING.
//
// Dry run by default: downloads and re-encodes in memory, prints the
// savings, writes nothing. Pass --apply to upload and update rows.
// Pass --limit=N to stop after N candidates.

const BUCKET = "product-images";
const MIN_BYTES = 300_000;
const MAX_EDGE = 1600;
const MIN_SAVING = 0.2;
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

type Row = { id: string; url: string };

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Every product_images row, paged (PostgREST caps a select at 1000).
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("product_images")
      .select("id, url")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < 1000) break;
  }

  // 2. Object sizes, one list call per product folder.
  const sizes = new Map<string, number>();
  const folders = new Set<string>();
  for (const r of rows) {
    const path = storagePath(r.url);
    if (path?.includes("/")) folders.add(path.split("/")[0]);
  }
  for (const folder of folders) {
    const { data } = await sb.storage.from(BUCKET).list(folder, { limit: 1000 });
    for (const f of data ?? []) {
      if (f.id != null) sizes.set(`${folder}/${f.name}`, f.metadata?.size ?? 0);
    }
  }

  const candidates = rows
    .map((r) => ({ ...r, path: storagePath(r.url) }))
    .filter((r): r is Row & { path: string } => r.path != null)
    .filter((r) => (sizes.get(r.path) ?? 0) > MIN_BYTES)
    .slice(0, limit);

  const totalBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
  console.log(`rows            : ${rows.length}`);
  console.log(`folder size     : ${(totalBytes / 1e6).toFixed(1)} MB (incl. orphans)`);
  console.log(`candidates      : ${candidates.length} (> ${MIN_BYTES / 1000} KB)`);
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN (pass --apply to write)\n");

  let before = 0;
  let after = 0;
  let rewritten = 0;
  for (const c of candidates) {
    const { data: blob, error } = await sb.storage.from(BUCKET).download(c.path);
    if (error || !blob) {
      console.log(`  skip ${c.path}: ${error?.message ?? "no data"}`);
      continue;
    }
    const input = Buffer.from(await blob.arrayBuffer());
    const meta = await sharp(input).metadata();
    const keepAlpha = meta.hasAlpha === true;
    const pipeline = sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
    const output = keepAlpha
      ? await pipeline.webp({ quality: 82 }).toBuffer()
      : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

    const saving = 1 - output.length / input.length;
    const line = `${c.path}  ${kb(input.length)} -> ${kb(output.length)}  (${meta.width}x${meta.height}, -${Math.round(saving * 100)}%)`;
    if (saving < MIN_SAVING) {
      console.log(`  keep ${line}`);
      continue;
    }
    before += input.length;
    after += output.length;
    rewritten++;
    console.log(`  ${apply ? "write" : "would write"} ${line}`);
    if (!apply) continue;

    const ext = keepAlpha ? "webp" : "jpg";
    const newPath = `${c.path.replace(/\.[a-z0-9]+$/i, "")}-c.${ext}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(newPath, output, {
      cacheControl: "31536000",
      contentType: keepAlpha ? "image/webp" : "image/jpeg",
      upsert: false,
    });
    if (upErr) {
      console.log(`    upload failed: ${upErr.message}`);
      continue;
    }
    const newUrl = sb.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
    const { error: updErr } = await sb
      .from("product_images")
      .update({ url: newUrl })
      .eq("id", c.id);
    if (updErr) console.log(`    row update failed: ${updErr.message}`);
  }

  console.log(
    `\n${rewritten} files: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB` +
      ` (saves ${((before - after) / 1e6).toFixed(1)} MB)`,
  );
  if (apply && rewritten > 0) {
    console.log(
      "Originals kept. Check the site, revalidate pages (or redeploy), then run prune-orphan-images.",
    );
  }
}

function storagePath(url: string): string | null {
  const i = url.indexOf(MARKER);
  return i === -1 ? null : decodeURIComponent(url.slice(i + MARKER.length));
}

function kb(n: number): string {
  return `${Math.round(n / 1000)} KB`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
