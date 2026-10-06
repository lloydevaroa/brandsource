// Sets products.unit_price (the flat selling price) from Trends cost:
// the lowest quantity break's unit cost plus a markup. Only fills products
// whose unit_price is still empty, so hand-set prices are never overwritten.
// Setup fees and extras are not included. Interim pricing for testing until
// Joe confirms a pricing rule.
//
// Needs supabase/supplier-pricing.sql run and trends-pricing-import.mjs done.
// Usage: node --env-file=.env.local scripts/apply-markup-prices.mjs [--markup=60] [--dry-run]

import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const markup = Number((process.argv.find((a) => a.startsWith("--markup=")) ?? "--markup=60").split("=")[1]);
if (!Number.isFinite(markup) || markup < 0) throw new Error("Bad --markup");

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error } = await db.from("products").select("id, name, unit_price").eq("supplier", "trends");
if (error) throw error;
const { data: breaks, error: bErr } = await db.from("product_price_breaks").select("product_id, min_qty, unit_cost");
if (bErr) throw bErr;

const lowest = new Map();
for (const b of breaks) {
  const cur = lowest.get(b.product_id);
  if (!cur || b.min_qty < cur.min_qty) lowest.set(b.product_id, b);
}

let set = 0, kept = 0, none = 0;
for (const p of products) {
  const b = lowest.get(p.id);
  if (!b) { none++; continue; }
  if (p.unit_price != null) { kept++; continue; }
  const price = Math.round(Number(b.unit_cost) * (1 + markup / 100) * 100) / 100;
  console.log(`${p.name}: cost $${b.unit_cost} @${b.min_qty} -> $${price}`);
  if (!DRY) {
    const { error: uErr } = await db.from("products").update({ unit_price: price }).eq("id", p.id).is("unit_price", null);
    if (uErr) throw uErr;
  }
  set++;
}
console.log(`\n${DRY ? "Dry run: would set" : "Set"} ${set} prices at +${markup}%; ${kept} already priced, ${none} with no cost data.`);
