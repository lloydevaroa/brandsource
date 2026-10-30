// Switches freshly backfilled Trends products on: copies each product's branding template PDF
// into our own Storage, then sets active = true. The backfill imports everything hidden and
// skips templates; this is the step that makes a batch available on the storefront.
//
// By default it takes every hidden Trends product imported in the last 24 hours that has no
// template yet. Use --codes to name products instead (any imported Trends code, hidden or not).
//
// Usage: node --env-file=.env.local scripts/trends-release.mjs [--hours 24] [--codes 100128,100300] [--dry-run]
// Needs TRENDS_API_TOKEN (or username and password) and the Supabase keys in .env.local.
// Trends Data is confidential: nothing here writes it to disk.

import { createClient } from "@supabase/supabase-js";
import { mapProduct } from "./lib/trends-map.mjs";

const DRY = process.argv.includes("--dry-run");
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : null; };
const HOURS = Number(arg("hours") ?? 24);
const CODES = arg("codes") ? arg("codes").split(",").map((c) => c.trim()).filter(Boolean) : null;

const BASE = "https://nz.api.trends.nz/api/v1";
const BUCKET = "product-images";
const API_GAP_MS = 1500;
const MAX_IN_A_ROW = 3;

const { TRENDS_API_TOKEN: token, TRENDS_API_USERNAME: user, TRENDS_API_PASSWORD: pass } = process.env;
const auth = token ? `Bearer ${token}` : `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let query = db.from("products").select("id, slug, supplier_code, active, product_details").eq("supplier", "trends");
query = CODES
  ? query.in("supplier_code", CODES)
  : query.eq("active", false).gte("imported_at", new Date(Date.now() - HOURS * 3600e3).toISOString());
const { data: rows, error } = await query.order("supplier_code");
if (error) throw error;
const todo = CODES ? rows : rows.filter((r) => !r.product_details?.template_url);
console.log(`${todo.length} product${todo.length === 1 ? "" : "s"} to release.`);
if (DRY) { for (const r of todo) console.log(`  ${r.slug} [${r.supplier_code}]`); process.exit(0); }

let released = 0, noTemplate = 0, failedInARow = 0;
for (const r of todo) {
  try {
    await sleep(API_GAP_MS);
    const res = await fetch(`${BASE}/products/${encodeURIComponent(r.supplier_code)}.json`, { headers: { Authorization: auth, Accept: "application/json" } });
    if (res.status === 429 || res.status >= 500) throw new Error(`STOP: Trends returned ${res.status}`);
    if (!res.ok) throw new Error(`Trends returned ${res.status} for ${r.supplier_code}`);
    const d = await res.json();
    const one = Array.isArray(d) ? d : d.data ?? d;
    const { templateSrc } = mapProduct(Array.isArray(one) ? one[0] : one);

    const details = { ...(r.product_details ?? {}) };
    if (templateSrc && !details.template_url) {
      // A template the supplier won't serve shouldn't block the product.
      const t = await fetch(encodeURI(templateSrc.startsWith("//") ? `https:${templateSrc}` : templateSrc));
      if (t.ok) {
        const path = `trends/${r.supplier_code}/branding-template.pdf`;
        const { error: upErr } = await db.storage.from(BUCKET).upload(path, await t.arrayBuffer(), { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        details.template_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      } else console.warn(`  (no branding template for ${r.slug}: HTTP ${t.status})`);
    }
    if (!details.template_url) noTemplate++;

    const { error: updErr } = await db.from("products").update({ active: true, product_details: details }).eq("id", r.id);
    if (updErr) throw updErr;
    released++;
    failedInARow = 0;
  } catch (e) {
    console.error(`  FAILED ${r.slug}: ${e.message}`);
    if (e.message.startsWith("STOP") || ++failedInARow >= MAX_IN_A_ROW) { console.error("Stopping. Run it again; it picks up the rest."); break; }
  }
}
console.log(`Released ${released} of ${todo.length}. ${noTemplate} have no branding template.`);
