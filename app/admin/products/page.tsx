import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteProduct } from "../actions";
import { DeleteButton } from "../DeleteButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  sku: string | null;
  name: string;
  price: number | string;
  currency: string;
  status: string;
  condition: string;
  product_line: { name: string } | { name: string }[] | null;
};

export default async function ProductsListPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select(
      "id, sku, name, price, currency, status, condition, product_line:product_lines ( name )",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products ({rows.length})</h1>
        <Link
          href="/admin/products/new"
          className="bg-black text-white px-3 py-1 text-sm"
        >
          + New Product
        </Link>
      </div>

      <table className="w-full text-sm border border-zinc-300">
        <thead className="bg-zinc-100 text-left">
          <tr>
            <th className="px-2 py-2 border-b">SKU</th>
            <th className="px-2 py-2 border-b">Name</th>
            <th className="px-2 py-2 border-b">Line</th>
            <th className="px-2 py-2 border-b">Price</th>
            <th className="px-2 py-2 border-b">Status</th>
            <th className="px-2 py-2 border-b">Condition</th>
            <th className="px-2 py-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const line = Array.isArray(r.product_line)
              ? r.product_line[0]
              : r.product_line;
            return (
              <tr key={r.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                <td className="px-2 py-1 font-mono text-xs">{r.sku ?? "—"}</td>
                <td className="px-2 py-1">{r.name}</td>
                <td className="px-2 py-1">{line?.name ?? "—"}</td>
                <td className="px-2 py-1">
                  {r.currency} {r.price}
                </td>
                <td className="px-2 py-1">{r.status}</td>
                <td className="px-2 py-1">{r.condition}</td>
                <td className="px-2 py-1 flex gap-3">
                  <Link
                    href={`/admin/products/${r.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteButton
                    action={deleteProduct}
                    id={r.id}
                    confirm={`Delete "${r.name}"?`}
                  />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-3 text-center text-zinc-600">
                No products.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
