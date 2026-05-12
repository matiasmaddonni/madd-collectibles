import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "./actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Badge counts unique products with pending review work (field
  // proposals OR crawler-uploaded images), matching the list view's
  // grouped-by-product cards.
  let pendingProposals = 0;
  if (user) {
    const admin = createAdminClient();
    const [propRes, imgRes] = await Promise.all([
      admin
        .from("crawl_proposals")
        .select("product_id")
        .eq("status", "pending"),
      admin
        .from("product_images")
        .select("product_id")
        .not("proposed_by_source", "is", null),
    ]);
    const productIds = new Set<string>();
    for (const r of (propRes.data ?? []) as Array<{ product_id: string }>) {
      productIds.add(r.product_id);
    }
    for (const r of (imgRes.data ?? []) as Array<{ product_id: string }>) {
      productIds.add(r.product_id);
    }
    pendingProposals = productIds.size;
  }

  return (
    <>
      {/*
        Override the storefront's dark body background so iOS overscroll /
        pull-to-refresh / address-bar reveal don't expose a black band behind
        the admin UI. Scoped to admin segment via this style tag living only
        in the admin layout's render tree.
      */}
      <style>{`
        html, body { background: #ffffff !important; color-scheme: light; }
      `}</style>
      <div className="min-h-dvh bg-white text-black font-sans">
        {user && (
        <nav className="border-b border-zinc-300 bg-zinc-50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold">MADD admin</span>
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/products" className="hover:underline">Products</Link>
          <Link href="/admin/brands" className="hover:underline">Brands</Link>
          <Link href="/admin/product-lines" className="hover:underline">Lines</Link>
          <Link href="/admin/series" className="hover:underline">Series</Link>
          <Link href="/admin/proposals" className="hover:underline">
            Proposals{pendingProposals > 0 ? ` (${pendingProposals})` : ""}
          </Link>
          <span className="text-zinc-600 sm:ml-auto break-all max-w-[40ch]">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="px-3 py-1 border border-zinc-400 hover:bg-zinc-200"
            >
              Sign out
            </button>
          </form>
        </nav>
      )}
        <main className="px-4 py-6 max-w-6xl mx-auto">{children}</main>
      </div>
    </>
  );
}
