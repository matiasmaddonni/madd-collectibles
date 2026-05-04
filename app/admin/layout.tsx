import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {user && (
        <nav className="border-b border-zinc-300 bg-zinc-50 px-4 py-3 flex items-center gap-4 text-sm">
          <span className="font-semibold">MADD admin</span>
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/products" className="hover:underline">Products</Link>
          <Link href="/admin/brands" className="hover:underline">Brands</Link>
          <Link href="/admin/product-lines" className="hover:underline">Lines</Link>
          <Link href="/admin/series" className="hover:underline">Series</Link>
          <span className="ml-auto text-zinc-600">{user.email}</span>
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
  );
}
