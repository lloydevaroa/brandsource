import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { saveProductCategories } from "./actions";

export default async function CategoriesAdminPage() {
  const staffResult = await requireStaffProfile("Categories");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const [cats, prods, links, supplierRows] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, parent_id, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("products").select("id, name, active").order("name", { ascending: true }),
    supabase.from("product_categories").select("product_id, category_id"),
    // Internal only. Ignored if supabase/suppliers.sql has not been run yet.
    supabase.from("products").select("id, supplier:suppliers ( name )"),
  ]);
  const supplierOf = new Map<string, string>();
  for (const r of (supplierRows.data ?? []) as unknown as { id: string; supplier: { name: string } | { name: string }[] | null }[]) {
    const sup = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier;
    if (sup) supplierOf.set(r.id, sup.name);
  }
  const error = cats.error ?? prods.error ?? links.error;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="mt-2 text-red-600">Could not load: {error.message}</p>
      </div>
    );
  }

  const choices = (cats.data ?? []).filter((c) => c.parent_id !== null);
  const assigned = new Map<string, Set<string>>();
  for (const l of links.data ?? []) {
    const set = assigned.get(l.product_id) ?? new Set<string>();
    set.add(l.category_id);
    assigned.set(l.product_id, set);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Product categories</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tick the categories each product belongs to, then save. A category with no products shows
          &quot;Coming soon&quot; on the storefront and fills in as soon as one is ticked here.
        </p>

        <ul className="mt-8 space-y-4">
          {(prods.data ?? []).map((p) => {
            const mine = assigned.get(p.id) ?? new Set<string>();
            return (
              <li key={p.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                <form action={saveProductCategories}>
                  <input type="hidden" name="productId" value={p.id} />
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-medium">
                      {p.name}
                      {supplierOf.get(p.id) ? <span className="ml-2 text-xs text-zinc-400">{supplierOf.get(p.id)}</span> : null}
                      {!p.active ? <span className="ml-2 text-xs text-zinc-400">inactive</span> : null}
                    </h2>
                    <button
                      type="submit"
                      className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Save
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    {choices.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" name="category" value={c.id} defaultChecked={mine.has(c.id)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
