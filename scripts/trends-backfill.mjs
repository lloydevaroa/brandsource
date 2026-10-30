// Brings the rest of the Trends catalogue into BrandSource in nightly batches, gently.
// Run it by hand each evening; it carries on from wherever the last run stopped.
//
// Each run: reads the product list from Trends in pages of 100, skips every code BrandSource
// already has, takes the next --limit new sellable ones, reads each in full (the list has no
// pricing) and imports them as HIDDEN products (active = false,
// nothing reaches the storefront until a category is released). There is no queue: the
// products table is the record of what is done, so a failed or interrupted night is simply
// picked up again next time.
//
// Per product: images copied into our own Storage (resized to 1600px, WebP, so the bucket
// stays small), colours, Trends category mirror (supabase/categories-trends.sql +
// trends-categories-sync.mjs) plus the Trade Show categories trends-import.mjs knows,
// supplier cost pricing, and the selling price (lowest break cost + 50%, rounded up).
// Branding template PDFs are NOT copied for hidden products; releasing a category runs
// trends-import.mjs --codes for it, which copies them and switches the products on.
//
// Gentle on Trends: 1.5 s between API calls, 0.6 s between image downloads, and it stops
// the run on the first 429 or 5xx. Three failed products in a row also stops it.
//
// Usage: node --env-file=.env.local scripts/trends-backfill.mjs [--limit 225] [--dry-run] [--codes 100109,100110]
// Needs TRENDS_API_TOKEN (or username and password) and the Supabase keys in .env.local.
// Trends Data is confidential: nothing here writes it to disk, apart from the skipped list below
// (code, name and the unrecognised charge types only, in the gitignored trends-sample/ folder).
//
// Products with an extra-charge type our product_extra_costs table doesn't allow (only DO, DS
// and OE exist) are set aside, not imported, and recorded in trends-sample/skipped-extra-costs.json
// so later runs leave them alone. They are a decision for Joe and the team (see the build brief).

import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { NEW_CATEGORIES, SELL_MARKUP_PCT, cents, mapPricing, mapProduct, roundUp } from "./lib/trends-map.mjs";

const DRY = process.argv.includes("--dry-run");
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : null; };
const LIMIT = Number(arg("limit") ?? 225);
const ONLY = arg("codes") ? new Set(arg("codes").split(",").map((c) => c.trim())) : null;
if (!Number.isFinite(LIMIT) || LIMIT < 1) throw new Error("Bad --limit");

const BASE = "https://nz.api.trends.nz/api/v1";
const BUCKET = "product-images";
const API_GAP_MS = 1500;
const IMAGE_GAP_MS = 600;
const MAX_IN_A_ROW = 3;
const KNOWN_EXTRA_KINDS = new Set(["DO", "DS", "OE"]); // supabase/supplier-pricing.sql check constraint
const SKIPPED_FILE = new URL("../trends-sample/skipped-extra-costs.json", import.meta.url);

const { TRENDS_API_TOKEN: token, TRENDS_API_USERNAME: user, TRENDS_API_PASSWORD: pass } = process.env;
const auth = token ? `Bearer ${token}` : `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Backoff extends Error {}
process.on("uncaughtException", (e) => {
  if (!(e instanceof Backoff)) throw e;
  console.error(`\nSTOPPED: ${e.message}. Run it again later; it picks up where it left off.`);
  process.exit(2);
});

async function api(path) {
  await sleep(API_GAP_MS);
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
  if (res.status === 429 || res.status >= 500) throw new Backoff(`Trends returned ${res.status} on ${path}`);
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  return res.json();
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });
const check = (r) => { if (r.error) throw r.error; return r.data; };

// Supabase caps a select at 1000 rows, so page through.
async function all(table, cols, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const data = check(await filter(db.from(table).select(cols)).order("id").range(from, from + 999));
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const sellable = (p) => p.active === "Active" && ["Normal", "New"].includes(p.status);

const skipped = await readFile(SKIPPED_FILE, "utf8").then(JSON.parse, () => ({}));

// What we already hold, so the run only takes products we have never imported.
const products = await all("products", "id, slug, supplier_code, supplier", (q) => q);
const have = new Set(products.filter((p) => p.supplier === "trends").map((p) => p.supplier_code));
const usedSlugs = new Set(products.map((p) => p.slug));

const cats = await all("categories", "id, slug, trends_num").catch(async (e) => {
  if (!DRY) throw new Error(`${e.message} (has supabase/categories-trends.sql been run?)`);
  console.warn(`(${e.message}: Trends categories not set up yet, so none will be placed in this dry run)\n`);
  return all("categories", "id, slug");
});
const idBySlug = new Map(cats.map((c) => [c.slug, c.id]));
const idByNum = new Map(cats.filter((c) => c.trends_num).map((c) => [c.trends_num, c.id]));

// The next batch: walk the list until enough new sellable products are found.
const picked = [];
let notSellable = 0, total = 0, pagesRead = 0;
for (let page = 1, pages = 1; page <= pages && picked.length < LIMIT; page++) {
  const j = await api(`/products.json?page_size=100&page_no=${page}`);
  pages = j.page_count;
  total = j.total_items;
  pagesRead++;
  for (const p of j.data) {
    if (have.has(String(p.code)) || String(p.code) in skipped || (ONLY && !ONLY.has(String(p.code)))) continue;
    if (!sellable(p)) { notSellable++; continue; }
    if (picked.length < LIMIT) picked.push(p);
  }
}
console.log(`Trends lists ${total} products; BrandSource holds ${have.size}. Read ${pagesRead} list pages, taking ${picked.length} new (${notSellable} discontinued or inactive skipped on the way).`);

// The list leaves pricing empty, so each product is read in full once (one call each).
// A 429 or 5xx here stops the run before anything has been written.
const detailed = [];
for (const { code } of picked) {
  const d = await api(`/products/${encodeURIComponent(code)}.json`);
  const one = Array.isArray(d) ? d : d.data ?? d;
  detailed.push(Array.isArray(one) ? one[0] : one);
}

const mapped = detailed.map((p) => {
  const m = mapProduct(p);
  let slug = m.row.slug;
  if (usedSlugs.has(slug)) slug = `${slug}-${m.row.supplier_code}`;
  usedSlugs.add(slug);
  const mirrored = [...new Set((p.categories ?? []).map((c) => idByNum.get(String(c.num))).filter(Boolean))];
  const legacy = m.categories.map((s) => idBySlug.get(s)).filter(Boolean);
  const unmapped = (p.categories ?? []).map((c) => String(c.num)).filter((n) => !idByNum.has(n));
  const pricing = mapPricing(p);
  const lowest = pricing?.breaks.length ? pricing.breaks.reduce((a, b) => (b.min_qty < a.min_qty ? b : a)) : null;
  const price = lowest ? roundUp(cents(Number(lowest.unit_cost) * (1 + SELL_MARKUP_PCT / 100))) : null;
  return { ...m, row: { ...m.row, slug }, categoryIds: [...new Set([...mirrored, ...legacy])], unmapped, pricing, price };
});

// Set aside products with a charge type we have no place for, rather than fail on them.
const unknownKinds = (i) => [...new Set((i.pricing?.extras ?? []).map((e) => e.kind).filter((k) => !KNOWN_EXTRA_KINDS.has(k)))];
const items = mapped.filter((i) => !unknownKinds(i).length);
const setAside = mapped.filter((i) => unknownKinds(i).length);
for (const i of setAside) skipped[i.row.supplier_code] = { name: i.row.name, kinds: unknownKinds(i), found: new Date().toISOString().slice(0, 10) };
if (setAside.length) {
  console.log(`Set aside ${setAside.length} with an extra-charge type we don't store: ${setAside.map((i) => `${i.row.supplier_code} ${i.row.name} (${unknownKinds(i).join("/")})`).join("; ")}`);
  if (!DRY) { await mkdir(new URL("../trends-sample/", import.meta.url), { recursive: true }); await writeFile(SKIPPED_FILE, JSON.stringify(skipped, null, 2)); }
}

if (DRY) {
  const unmapped = new Map();
  for (const i of items) {
    console.log(`${i.row.slug} [${i.row.supplier_code}] $${i.price ?? "no price"} | ${i.categoryIds.length} categories | ${i.images.length} images, ${i.colours.length} colours`);
    for (const n of i.unmapped) unmapped.set(n, (unmapped.get(n) ?? 0) + 1);
  }
  const noPrice = items.filter((i) => i.price === null);
  const noCats = items.filter((i) => i.categoryIds.length === 0);
  console.log(`\nDry run: ${items.length} products, ${items.reduce((n, i) => n + i.images.length, 0)} images to copy, nothing written.`);
  console.log(`No cost data, so no selling price: ${noPrice.length}${noPrice.length ? " (" + noPrice.map((i) => i.row.supplier_code).join(", ") + ")" : ""}`);
  console.log(`In no category at all: ${noCats.length}${noCats.length ? " (" + noCats.map((i) => i.row.supplier_code).join(", ") + ")" : ""}`);
  if (unmapped.size) console.log(`Trends category numbers with no storefront category: ${[...unmapped].map(([n, c]) => `${n}x${c}`).join(", ")}`);
  process.exit(0);
}

const supplierId = check(await db.from("suppliers").select("id").eq("slug", "trends").maybeSingle())?.id ?? null;

// Insert only, so any category already there (or renamed by hand) is left alone.
const tradeShow = check(await db.from("categories").select("id").eq("slug", "trade-show-and-events").single());
check(await db.from("categories").upsert(NEW_CATEGORIES.map((c) => ({ ...c, parent_id: tradeShow.id })), { onConflict: "slug", ignoreDuplicates: true }));
const { error: bucketErr } = await db.storage.createBucket(BUCKET, { public: true });
if (bucketErr && !/already exists/i.test(bucketErr.message)) throw bucketErr;

async function copyImage(code, img) {
  await sleep(IMAGE_GAP_MS);
  const link = img.link.trim();
  const res = await fetch(link.startsWith("//") ? `https:${link}` : link);
  if (res.status === 429 || res.status >= 500) throw new Backoff(`Image host returned ${res.status} for ${link}`);
  if (!res.ok) throw new Error(`Image ${link}: HTTP ${res.status}`);
  const webp = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const path = `trends/${code}/${img.name.replace(/\.[^.]+$/, "")}.webp`;
  const { error } = await db.storage.from(BUCKET).upload(path, webp, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function importOne(i) {
  const urls = [];
  for (const img of i.images) urls.push(await copyImage(i.row.supplier_code, img));

  // The products row is what marks a product as done, so it goes in first and is removed
  // again if anything after it fails, leaving the product to be retried next run.
  const product = check(await db.from("products")
    .insert({ ...i.row, active: false, unit_price: i.price, ...(supplierId ? { supplier_id: supplierId } : {}), example_image_urls: urls, product_details: i.details })
    .select("id").single());
  try {
    if (i.categoryIds.length) {
      check(await db.from("product_categories").upsert(i.categoryIds.map((category_id) => ({ product_id: product.id, category_id })), { onConflict: "product_id,category_id", ignoreDuplicates: true }));
    }
    if (i.colours.length) {
      const group = check(await db.from("option_groups")
        .upsert({ product_id: product.id, key: "colour", label: "Colour", selection: "single", required: true }, { onConflict: "product_id,key" })
        .select("id").single());
      check(await db.from("option_choices").upsert(
        i.colours.map((label, n) => ({ option_group_id: group.id, key: slugify(label), label, price_delta: 0, sort_order: n })),
        { onConflict: "option_group_id,key" },
      ));
    }
    if (i.pricing) {
      check(await db.from("product_supplier_pricing").upsert({ product_id: product.id, ...i.pricing.summary, imported_at: new Date().toISOString() }));
      if (i.pricing.breaks.length) check(await db.from("product_price_breaks").insert(i.pricing.breaks.map((b) => ({ product_id: product.id, ...b }))));
      if (i.pricing.extras.length) check(await db.from("product_extra_costs").insert(i.pricing.extras.map((e) => ({ product_id: product.id, ...e }))));
    }
  } catch (e) {
    await db.from("products").delete().eq("id", product.id);
    throw e;
  }
  return urls.length;
}

let done = 0, failed = 0, inARow = 0, stopped = null;
const started = Date.now();
for (const i of items) {
  try {
    const n = await importOne(i);
    done++;
    inARow = 0;
    console.log(`[${done}/${items.length}] ${i.row.slug} (${n} images, $${i.price ?? "no price"}, ${i.categoryIds.length} categories)`);
  } catch (e) {
    if (e instanceof Backoff) { stopped = e.message; break; }
    failed++;
    console.warn(`  FAILED ${i.row.slug} [${i.row.supplier_code}]: ${e.message}`);
    if (++inARow >= MAX_IN_A_ROW) { stopped = `${MAX_IN_A_ROW} products failed in a row`; break; }
  }
}
const mins = Math.round((Date.now() - started) / 60000);
console.log(`\n${stopped ? `STOPPED EARLY: ${stopped}. Run it again later; it picks up where it left off.\n` : ""}Done: ${done} imported (all hidden), ${failed} failed, ${mins} min. About ${Math.max(0, total - have.size - done - Object.keys(skipped).length)} products left in Trends not yet held here, plus ${Object.keys(skipped).length} set aside (extra-charge type to decide on).`);
if (stopped) process.exit(2);
