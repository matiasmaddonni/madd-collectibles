import { createAdminClient } from "@/lib/supabase/admin";
import { upsertLine, deleteLine } from "../actions";
import { DeleteButton } from "../DeleteButton";

export const dynamic = "force-dynamic";

const inputClass = "border border-zinc-400 px-2 py-1 text-sm bg-white text-black";

export default async function ProductLinesPage() {
  const admin = createAdminClient();
  const [linesRes, brandsRes] = await Promise.all([
    admin
      .from("product_lines")
      .select("id, name, slug, brand_id")
      .order("sort_order"),
    admin.from("brands").select("id, name").order("sort_order"),
  ]);
  const rows = (linesRes.data ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    brand_id: string;
  }[];
  const brands = (brandsRes.data ?? []) as unknown as {
    id: string;
    name: string;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Product lines</h1>

      <section>
        <h2 className="text-sm font-semibold mb-2">Add new line</h2>
        <form action={upsertLine} className="flex gap-2 items-end flex-wrap">
          <label className="flex flex-col gap-1 text-xs">
            <span>Name</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>Slug</span>
            <input name="slug" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>Brand</span>
            <select name="brand_id" required className={inputClass}>
              <option value="">— select —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="bg-black text-white px-3 py-1 text-sm">
            Add
          </button>
        </form>
      </section>

      <ul className="border border-zinc-300 divide-y divide-zinc-200">
        {rows.map((r) => (
          <li
            key={r.id}
            className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm"
          >
            <form
              action={upsertLine}
              className="flex flex-wrap items-center gap-2 flex-1"
            >
              <input type="hidden" name="id" value={r.id} />
              <label className="flex items-center gap-1">
                <span className="text-xs text-zinc-600">name</span>
                <input name="name" defaultValue={r.name} className={inputClass} />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs text-zinc-600">slug</span>
                <input name="slug" defaultValue={r.slug} className={inputClass} />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs text-zinc-600">brand</span>
                <select
                  name="brand_id"
                  defaultValue={r.brand_id}
                  className={inputClass}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="text-blue-700 hover:underline text-xs">
                Save
              </button>
            </form>
            <DeleteButton
              action={deleteLine}
              id={r.id}
              confirm={`Delete line "${r.name}"?`}
            />
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-3 py-2 text-zinc-600">No lines.</li>
        )}
      </ul>
    </div>
  );
}
