// Sets products.unit_price (the flat selling price) from Trends cost:
// the lowest quantity break's unit cost plus a markup. Only fills products
// whose unit_price is still empty, so hand-set prices are never overwritten.
// Setup fees and extras are not included. Interim pricing for testing until
// Joe confirms a pricing rule.
//
// The marked-up figure is then rounded UP to a retail-style price by band (see
// roundUp), so the margin never drops below the markup. A price is only written
// if it is empty, or still equals this script's own earlier output (the raw
// markup or the rounded figure); anything hand-set in the admin is left alone.
//
// Needs supabase/supplier-pricing.sql run and trends-pricing-import.mjs done.
// Usage: node --env-file=.env.local scripts/apply-markup-prices.mjs [--markup=60] [--dry-run]

import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const markup = Number((process.argv.find((a) => a.startsWith("--markup=")) ?? "--markup=60").split("=")[1]);
if (!Number.isFinite(markup) || markup < 0) throw new Error("Bad --markup");

const cents = (n) => Math.round(n * 100) / 100;

// Up only, never down. Bands on the marked-up price (ex-GST):
//   under $1        nearest $0.05          0.77  -> 0.80
//   $1 to under $10 nearest $0.05          2.48  -> 2.50
//   $10 to $100     next x.95              29.60 -> 29.95
//   $100 to $1,000  next price ending 4.95 or 9.95   432.86 -> 434.95
//   $1,000 and up   next whole price ending in 9     4456.58 -> 4459
function roundUp(p) {
  const x = cents(p);
  if (x < 10) return cents(Math.ceil(x * 20 - 1e-9) / 20);
  if (x < 100) return cents(Math.ceil(x - 0.95 - 1e-9) + 0.95);
  if (x < 1000) return cents(Math.ceil((x + 0.05) / 5 - 1e-9) * 5 - 0.05);
  return Math.ceil((x + 1) / 10 - 1e-9) * 10 - 1;
}

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
  const raw = cents(Number(b.unit_cost) * (1 + markup / 100));
  const price = roundUp(raw);
  const current = p.unit_price == null ? null : Number(p.unit_price);
  if (current != null && current !== raw) { kept++; continue; } // hand-set, or already rounded
  console.log(`${p.name}: cost $${b.unit_cost} @${b.min_qty} -> +${markup}% $${raw} -> $${price}`);
  if (!DRY) {
    const q = db.from("products").update({ unit_price: price }).eq("id", p.id);
    const { error: uErr } = await (current == null ? q.is("unit_price", null) : q.eq("unit_price", current));
    if (uErr) throw uErr;
  }
  set++;
}
console.log(`\n${DRY ? "Dry run: would set" : "Set"} ${set} prices at +${markup}% rounded up; ${kept} left as they are (hand-set or already rounded), ${none} with no cost data.`);
