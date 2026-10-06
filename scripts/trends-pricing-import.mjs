// Loads Trends cost pricing for products already imported: quantity breaks,
// extra charges (setup, second side, optional extras), the less-than-MOQ flag
// and the pricing comment. Cost only; products.unit_price (the sell price) is
// not touched and nothing here is shown to customers.
//
// Reads trends-sample/products.json (same file trends-import.mjs uses) and
// matches products by supplier + supplier_code. Needs supabase/supplier-pricing.sql
// run once. Safe to re-run: each product's pricing rows are replaced.
//
// Usage: node --env-file=.env.local scripts/trends-pricing-import.mjs [--dry-run]
// Trends Data is confidential: never commit trends-sample/.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function mapPricing(p) {
  const pr = p.pricing?.[0];
  if (!pr) return null;
  return {
    code: String(p.code),
    name: p.name,
    summary: {
      price_type: clean(pr.type),
      price_basis: clean(pr.primary_price_description),
      orderable_below_moq: pr.less_than_moq === "Y",
      pricing_comment: clean(pr.pricing_comment),
      supplier_updated_at: p.last_updated ? new Date(p.last_updated.replace(" ", "T") + "Z").toISOString() : null,
    },
    breaks: (pr.prices ?? []).map((b) => ({ min_qty: b.quantity, unit_cost: b.price })),
    extras: (pr.additional_costs ?? []).map((c) => ({
      supplier_charge_id: c.id,
      kind: c.type,
      branding_option: clean(c.branding_option),
      branding_area: clean(c.branding_area),
      description: clean(c.description),
      unit_cost: c.unit_price ?? 0,
      setup_cost: c.setup_price ?? c.setup ?? 0,
    })),
  };
}

const raw = JSON.parse(await readFile(new URL("../trends-sample/products.json", import.meta.url)));
const items = (Array.isArray(raw) ? raw : raw.products).map(mapPricing).filter(Boolean);

if (DRY) {
  for (const i of items) {
    const lo = i.breaks[0], hi = i.breaks.at(-1);
    console.log(
      `${i.name} [${i.code}] ${i.summary.price_type} | ${i.breaks.length} breaks` +
        (lo ? ` ($${lo.unit_cost} @${lo.min_qty} to $${hi.unit_cost} @${hi.min_qty})` : "") +
        ` | ${i.extras.length} extras | below-MOQ=${i.summary.orderable_below_moq}`,
    );
  }
  console.log(`\nDry run: ${items.length} products, nothing written.`);
  process.exit(0);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error: pErr } = await db.from("products").select("id, supplier_code").eq("supplier", "trends");
if (pErr) throw pErr;
const idByCode = new Map(products.map((p) => [p.supplier_code, p.id]));

let done = 0, skipped = 0;
for (const i of items) {
  const id = idByCode.get(i.code);
  if (!id) {
    console.warn(`  skipped ${i.name} [${i.code}]: not in products yet`);
    skipped++;
    continue;
  }
  const check = (r) => { if (r.error) throw r.error; };
  check(await db.from("product_supplier_pricing").upsert({ product_id: id, ...i.summary, imported_at: new Date().toISOString() }));
  // Replace the child rows so a break or charge Trends dropped doesn't linger.
  check(await db.from("product_price_breaks").delete().eq("product_id", id));
  check(await db.from("product_extra_costs").delete().eq("product_id", id));
  if (i.breaks.length) check(await db.from("product_price_breaks").insert(i.breaks.map((b) => ({ product_id: id, ...b }))));
  if (i.extras.length) check(await db.from("product_extra_costs").insert(i.extras.map((e) => ({ product_id: id, ...e }))));
  done++;
}
console.log(`\nDone: pricing loaded for ${done} products, ${skipped} skipped.`);
