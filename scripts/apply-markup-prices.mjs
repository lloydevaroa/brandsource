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
// Re-pricing: pass --from-markup=60 to move prices this script set at an earlier
// markup (raw or rounded) to the new --markup. Prices matching neither are
// treated as hand-set and left alone.
// Usage: node --env-file=.env.local scripts/apply-markup-prices.mjs [--markup=50] [--from-markup=60] [--dry-run]

import { createClient } from "@supabase/supabase-js";
import { cents, roundUp } from "./lib/trends-map.mjs";
import { reconcile, sendReviewDigest } from "./lib/overrides.mjs";

const DRY = process.argv.includes("--dry-run");
const arg = (name, dflt) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${dflt}`).split("=")[1];
const markup = Number(arg("markup", 50));
if (!Number.isFinite(markup) || markup < 0) throw new Error("Bad --markup");
const fromArg = arg("from-markup", "");
const fromMarkup = fromArg === "" ? null : Number(fromArg);
if (fromMarkup !== null && !Number.isFinite(fromMarkup)) throw new Error("Bad --from-markup");

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error } = await db.from("products").select("id, name, unit_price").eq("supplier", "trends");
if (error) throw error;
// Supabase caps a select at 1000 rows, so page through every price break.
const breaks = [];
for (let from = 0; ; from += 1000) {
  const { data, error: bErr } = await db.from("product_price_breaks").select("product_id, min_qty, unit_cost").order("product_id").order("min_qty").range(from, from + 999);
  if (bErr) throw bErr;
  breaks.push(...data);
  if (data.length < 1000) break;
}

// Prices the team edited on the Master data page are never touched; the price this script would
// set is recorded against the edit, and flagged for review if it differs from what it recorded.
const rrpOverrides = new Map();
{
  const { data, error: oErr } = await db.from("product_overrides").select("id, product_id, supplier_value").eq("field", "rrp");
  if (oErr && !/product_overrides|schema cache|does not exist/i.test(oErr.message)) throw oErr;
  for (const o of data ?? []) rrpOverrides.set(o.product_id, o);
}
const reviewChanges = [];

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
  const edited = rrpOverrides.get(p.id);
  if (edited) {
    if (!DRY) await reconcile(db, reviewChanges, { productId: p.id, label: p.name, field: "rrp", override: edited, supplierNow: price });
    kept++;
    continue;
  }
  const earlierRaw = fromMarkup == null ? null : cents(Number(b.unit_cost) * (1 + fromMarkup / 100));
  const mine = current == null || current === raw || (earlierRaw != null && (current === earlierRaw || current === roundUp(earlierRaw)));
  if (!mine || current === price) { kept++; continue; } // hand-set, or already at this price
  console.log(`${p.name}: cost $${b.unit_cost} @${b.min_qty} -> +${markup}% $${raw} -> $${price} (was ${current ?? "empty"})`);
  if (!DRY) {
    const q = db.from("products").update({ unit_price: price }).eq("id", p.id);
    const { error: uErr } = await (current == null ? q.is("unit_price", null) : q.eq("unit_price", current));
    if (uErr) throw uErr;
  }
  set++;
}
console.log(`\n${DRY ? "Dry run: would set" : "Set"} ${set} prices at +${markup}% rounded up; ${kept} left as they are (hand-set or already rounded), ${none} with no cost data.`);
if (!DRY) await sendReviewDigest(db, reviewChanges);
