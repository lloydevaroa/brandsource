// One-off: copies the hand-maintained src/data/catalog.ts products into
// Supabase (price, images, option groups and choices) so the database can be
// the single source of truth. Products in the DB that are not in catalog.ts
// and not imported from a supplier are set inactive (stale rows).
//
// Usage: node --env-file=.env.local scripts/sync-catalog-to-db.mjs [--dry-run]

import { createClient } from "@supabase/supabase-js";
import { catalog } from "../src/data/catalog.ts";

const DRY = process.argv.includes("--dry-run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: existing, error: eErr } = await db.from("products").select("id, slug, supplier");
if (eErr) throw eErr;
const keep = new Set(catalog.map((p) => p.slug));
const stale = existing.filter((p) => !keep.has(p.slug) && !p.supplier);

if (DRY) {
  console.log("Would sync:", catalog.map((p) => p.slug).join(", "));
  console.log("Would deactivate:", stale.map((p) => p.slug).join(", ") || "none");
  process.exit(0);
}

for (const [i, p] of catalog.entries()) {
  const { data: product, error } = await db
    .from("products")
    .upsert(
      {
        slug: p.slug,
        name: p.name,
        short_description: p.short_description,
        unit_price: p.unit_price,
        min_order_qty: p.min_order_qty,
        example_image_urls: p.example_image_urls,
        active: true,
        sort_order: i,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (error) throw error;

  const { error: dErr } = await db.from("option_groups").delete().eq("product_id", product.id);
  if (dErr) throw dErr;
  for (const [gi, g] of p.option_groups.entries()) {
    const { data: group, error: gErr } = await db
      .from("option_groups")
      .insert({ product_id: product.id, key: g.key, label: g.label, selection: g.selection, required: g.required, sort_order: gi })
      .select("id")
      .single();
    if (gErr) throw gErr;
    const { error: cErr } = await db.from("option_choices").insert(
      g.choices.map((c, ci) => ({ option_group_id: group.id, key: c.key, label: c.label, price_delta: c.price_delta, sort_order: ci })),
    );
    if (cErr) throw cErr;
  }
  console.log(`Synced ${p.slug}`);
}

for (const p of stale) {
  const { error } = await db.from("products").update({ active: false }).eq("id", p.id);
  if (error) throw error;
  console.log(`Deactivated ${p.slug}`);
}
