import "server-only";

const PUBLIC_MARKER = "/storage/v1/object/public/product-images/";

// Strip the Supabase public-URL prefix down to the bucket-relative path so
// we can hand it to `storage.from("product-images").remove([...])`. Returns
// null when the URL doesn't look like a Supabase product-images public URL
// (defensive against legacy / external image links). Single source of truth
// — previously duplicated in app/admin/actions.ts and proposals/actions.ts.
export function urlToStoragePath(url: string): string | null {
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx < 0) return null;
  return url.slice(idx + PUBLIC_MARKER.length);
}
