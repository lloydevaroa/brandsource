import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { createSupplier, setSupplierListingStatus, updateSupplier } from "./actions";

type Supplier = {
  id: string;
  name: string;
  slug: string | null;
  channel: string;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  listing_status: "active" | "sample" | "withdrawn";
  public_label: string | null;
  notes: string | null;
  active: boolean;
};

const STATUS_LABEL: Record<Supplier["listing_status"], string> = {
  active: "Live",
  sample: "Sample (pending approval)",
  withdrawn: "Withdrawn (hidden)",
};

const STATUS_STYLE: Record<Supplier["listing_status"], string> = {
  active: "bg-emerald-100 text-emerald-800",
  sample: "bg-amber-100 text-amber-800",
  withdrawn: "bg-zinc-200 text-zinc-700",
};

const CHANNEL_LABEL: Record<string, string> = {
  api: "API",
  email_po: "Email purchase order",
  manual_portal: "Manual / supplier portal",
};

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm";
const label = "block text-xs font-medium text-zinc-500";

function SupplierFields({ s }: { s?: Supplier }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>
        Name
        <input name="name" required defaultValue={s?.name ?? ""} className={input} />
      </label>
      <label className={label}>
        How we order from them
        <select name="channel" defaultValue={s?.channel ?? "manual_portal"} className={input}>
          {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Website
        <input name="website" defaultValue={s?.website ?? ""} className={input} />
      </label>
      <label className={label}>
        Contact name
        <input name="contact_name" defaultValue={s?.contact_name ?? ""} className={input} />
      </label>
      <label className={label}>
        Contact email
        <input name="contact_email" type="email" defaultValue={s?.contact_email ?? ""} className={input} />
      </label>
      <label className={label}>
        Contact phone
        <input name="contact_phone" defaultValue={s?.contact_phone ?? ""} className={input} />
      </label>
      <label className={label}>
        Listing status
        <select name="listing_status" defaultValue={s?.listing_status ?? "active"} className={input}>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Badge text while a sample (customers see this)
        <input name="public_label" placeholder="e.g. TLC sample" defaultValue={s?.public_label ?? ""} className={input} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Notes (internal)
        <textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} />
        Active (untick to hide all of this supplier&apos;s products and stop using them)
      </label>
    </div>
  );
}

export default async function SuppliersAdminPage() {
  const staffResult = await requireStaffProfile("Suppliers");
  if ("guard" in staffResult) return staffResult.guard;

  const supabase = createServiceSupabase();
  const [sup, prods] = await Promise.all([
    supabase.from("suppliers").select("*").order("name", { ascending: true }),
    supabase.from("products").select("name, active, supplier_id").order("name", { ascending: true }),
  ]);

  if (sup.error || prods.error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="mt-2 text-red-600">Could not load: {(sup.error ?? prods.error)?.message}</p>
        <p className="mt-2 text-sm text-zinc-600">
          If this mentions a missing column, run <code>supabase/suppliers.sql</code> once in the Supabase SQL
          editor, then reload.
        </p>
      </div>
    );
  }

  const suppliers = sup.data as Supplier[];
  const bySupplier = new Map<string, { name: string; active: boolean }[]>();
  let unassigned = 0;
  for (const p of prods.data ?? []) {
    if (!p.supplier_id) {
      unassigned++;
      continue;
    }
    const list = bySupplier.get(p.supplier_id) ?? [];
    list.push({ name: p.name, active: p.active });
    bySupplier.set(p.supplier_id, list);
  }

  const btn = "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Suppliers</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Every product records which supplier it comes from. That is internal and never shown to customers, with
          one exception: a supplier set to <strong>Sample</strong> shows its badge text on its products until the
          supplier approves. <strong>Approve</strong> turns the badge off, <strong>Withdraw</strong> hides every
          product from that supplier straight away, and you can bring them back at any time.
          {unassigned > 0 ? ` ${unassigned} product${unassigned === 1 ? "" : "s"} have no supplier recorded.` : ""}
        </p>

        <ul className="mt-8 space-y-4">
          {suppliers.map((s) => {
            const mine = bySupplier.get(s.id) ?? [];
            return (
              <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">
                      {s.name}
                      <span
                        className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.listing_status]}`}
                      >
                        {STATUS_LABEL[s.listing_status]}
                      </span>
                      {!s.active ? <span className="ml-2 text-xs text-zinc-400">inactive</span> : null}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {mine.length} product{mine.length === 1 ? "" : "s"} · {CHANNEL_LABEL[s.channel] ?? s.channel}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(
                      [
                        ["active", "Approve (go live)", "border-emerald-300 text-emerald-800 hover:bg-emerald-50"],
                        ["sample", "Back to sample", "border-amber-300 text-amber-800 hover:bg-amber-50"],
                        ["withdrawn", "Withdraw (hide)", "border-zinc-300 text-zinc-700 hover:bg-zinc-100"],
                      ] as const
                    )
                      .filter(([status]) => status !== s.listing_status)
                      .map(([status, text, cls]) => (
                        <form key={status} action={setSupplierListingStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" className={`${btn} ${cls}`}>
                            {text}
                          </button>
                        </form>
                      ))}
                  </div>
                </div>

                {mine.length > 0 ? (
                  <details className="mt-3 text-sm text-zinc-600">
                    <summary className="cursor-pointer text-xs text-zinc-500">Products from this supplier</summary>
                    <ul className="mt-2 columns-2 gap-6 text-xs">
                      {mine.map((p) => (
                        <li key={p.name}>
                          {p.name}
                          {!p.active ? <span className="text-zinc-400"> (inactive)</span> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-zinc-500">Edit details</summary>
                  <form action={updateSupplier} className="mt-4 space-y-4">
                    <input type="hidden" name="id" value={s.id} />
                    <SupplierFields s={s} />
                    <button
                      type="submit"
                      className="cursor-pointer rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Save
                    </button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        <section className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-white p-5">
          <h2 className="font-medium">Add a supplier</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Add the supplier here first. Their products are then loaded by an import script (or added by hand) and
            tagged with this supplier.
          </p>
          <form action={createSupplier} className="mt-4 space-y-4">
            <SupplierFields />
            <button
              type="submit"
              className="cursor-pointer rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add supplier
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
