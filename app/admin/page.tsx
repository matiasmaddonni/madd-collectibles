import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboard() {
  const admin = createAdminClient();

  // Single query for status breakdown; we tally client-side rather than
  // firing 4 COUNT(*) queries.
  const [statusRes, recentRes] = await Promise.all([
    admin.from("products").select("status"),
    admin
      .from("products")
      .select("id, name, slug, price, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const statusRows = (statusRes.data ?? []) as Array<{ status: string }>;
  let total = 0;
  let available = 0;
  let reserved = 0;
  let sold = 0;
  for (const row of statusRows) {
    total++;
    if (row.status === "available") available++;
    else if (row.status === "reserved") reserved++;
    else if (row.status === "sold") sold++;
  }
  const recent = recentRes.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Available" value={available} />
        <Stat label="Reserved" value={reserved} />
        <Stat label="Sold" value={sold} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recently added</h2>
        <ul className="border border-zinc-300 divide-y divide-zinc-200">
          {(recent ?? []).map((p) => (
            <li key={p.id} className="flex justify-between px-3 py-2 text-sm">
              <Link href={`/admin/products/${p.id}`} className="hover:underline">
                {p.name}
              </Link>
              <span className="text-zinc-600">
                {p.currency} {p.price} · {p.status}
              </span>
            </li>
          ))}
          {(!recent || recent.length === 0) && (
            <li className="px-3 py-2 text-sm text-zinc-600">No products yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-300 px-3 py-2">
      <div className="text-xs uppercase text-zinc-600">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
