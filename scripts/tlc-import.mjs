// Imports the whole TLC Live product guide (Sept 2024) as HIDDEN products with
// no images. The team makes and uploads the images, then switches products on.
//
// Source: ../../tlc-catalogue/products.json (the vault folder next to this repo).
// Every product is created inactive (active = false), so nothing shows on the
// storefront until someone switches it on. The importer only ever INSERTS products
// that don't exist yet: it never touches products that are already there, so it
// can be re-run safely without re-hiding products or wiping uploaded images.
//
// Every product is tagged with the TLC supplier (supabase/suppliers.sql, run it
// first). TLC's listing status there controls the "TLC sample" badge and can
// withdraw the whole range at once. No prices (quote only).
//
// Usage: node --env-file=.env.local scripts/tlc-import.mjs [--dry-run | --remove]
//   --remove  deletes every TLC product and any images stored for them

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const REMOVE = process.argv.includes("--remove");
const BUCKET = "product-images";
const SUPPLIER = "tlc";
const ROOT = new URL("../../tlc-catalogue/", import.meta.url);

// Categories named the way customers say them. Created if missing; renaming or
// moving them later in the admin is safe, the importer never overwrites them.
// Everything else uses the existing categories from supabase/categories.sql.
const NEW_CATEGORIES = [
  { slug: "banners", name: "Banners", sort_order: 35 },
  { slug: "stretch-fabric-displays", name: "Stretch Fabric Displays", sort_order: 36 },
  { slug: "signs", name: "Signs", sort_order: 37 },
  { slug: "bunting-and-pennants", name: "Bunting & Pennants", sort_order: 38 },
  { slug: "cafe-and-outdoor", name: "Cafe & Outdoor", sort_order: 39 },
  { slug: "event-accessories", name: "Event Accessories", sort_order: 41 },
];

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function mapProduct(p) {
  const specs = [];
  for (const [group, sizes] of Object.entries(p.sizes ?? {})) specs.push({ name: group, value: sizes.join(", ") });
  if (p.lead_time) specs.push({ name: "Lead time", value: p.lead_time });
  if (p.moq) specs.push({ name: "Minimum order", value: p.moq });
  if (p.notes) specs.push({ name: "Note", value: p.notes });
  const moq = parseInt(p.moq ?? "", 10);
  return {
    row: {
      slug: p.slug,
      name: p.name,
      short_description: p.short_description,
      active: false,
      supplier: SUPPLIER,
      supplier_code: p.slug.replace(/^tlc-/, ""),
      min_order_qty: Number.isFinite(moq) && moq > 0 ? moq : 1,
      unit_price: null,
      example_image_urls: [],
      sort_order: 200,
      imported_at: new Date().toISOString(),
    },
    categories: p.categories,
    details: {
      features: (p.specs ?? []).map(clean).filter(Boolean),
      specifications: specs,
      materials: [],
      dimensions: Object.entries(p.sizes ?? {}).map(([g, s]) => `${g}: ${s.join(", ")}`),
      branding_options: [],
      packaging: "",
      carton: null,
      template_url: null,
      image_captions: [],
    },
  };
}

const products = JSON.parse(await readFile(new URL("products.json", ROOT)));
const items = products.map(mapProduct);
for (const i of items) {
  if (!i.row.short_description) throw new Error(`No description for ${i.row.slug}`);
  if (!i.categories?.length) throw new Error(`No category for ${i.row.slug}`);
}
const slugs = items.map((i) => i.row.slug);
if (new Set(slugs).size !== slugs.length) throw new Error("Duplicate slugs in products.json");

if (DRY) {
  for (const i of items) console.log(`${i.row.slug} moq=${i.row.min_order_qty} categories=${i.categories.join(", ")}`);
  console.log(`\nDry run: ${items.length} products (all hidden, no images), nothing written.`);
  process.exit(0);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

if (REMOVE) {
  const { data: gone, error } = await db.from("products").delete().eq("supplier", SUPPLIER).select("slug");
  if (error) throw error;
  for (const g of gone ?? []) {
    const { data: files } = await db.storage.from(BUCKET).list(`${SUPPLIER}/${g.slug}`);
    if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => `${SUPPLIER}/${g.slug}/${f.name}`));
  }
  console.log(`Removed ${gone?.length ?? 0} TLC products and their images.`);
  process.exit(0);
}

const { data: supplier, error: supErr } = await db.from("suppliers").select("id, listing_status").eq("slug", SUPPLIER).maybeSingle();
if (supErr || !supplier) {
  throw new Error("TLC supplier not found. Run supabase/suppliers.sql in the Supabase SQL editor first.");
}

// Create our new categories under Trade Show & Events; never overwrite existing ones.
const { data: parent, error: parentErr } = await db.from("categories").select("id").eq("slug", "trade-show-and-events").single();
if (parentErr) throw parentErr;
const { error: catErr } = await db
  .from("categories")
  .upsert(NEW_CATEGORIES.map((c) => ({ ...c, parent_id: parent.id })), { onConflict: "slug", ignoreDuplicates: true });
if (catErr) throw catErr;

const { data: existing, error: exErr } = await db.from("products").select("slug").eq("supplier", SUPPLIER);
if (exErr) throw exErr;
const have = new Set((existing ?? []).map((p) => p.slug));

let added = 0;
for (const { row, categories, details } of items) {
  if (have.has(row.slug)) {
    console.log(`Skipped ${row.slug} (already there, left untouched)`);
    continue;
  }
  const { data: product, error } = await db
    .from("products")
    .insert({ ...row, supplier_id: supplier.id, product_details: details })
    .select("id")
    .single();
  if (error) throw error;

  const { data: cats, error: cErr } = await db.from("categories").select("id, slug").in("slug", categories);
  if (cErr) throw cErr;
  const missing = categories.filter((s) => !cats.some((c) => c.slug === s));
  if (missing.length) console.warn(`  (categories not found for ${row.slug}: ${missing.join(", ")})`);
  const { error: linkErr } = await db
    .from("product_categories")
    .upsert(cats.map((c) => ({ product_id: product.id, category_id: c.id })), { onConflict: "product_id,category_id", ignoreDuplicates: true });
  if (linkErr) throw linkErr;

  added++;
  console.log(`Added ${row.slug} (hidden, ${cats.length} categories)`);
}
console.log(`\nDone: ${added} added, ${items.length - added} already existed. All new products are hidden with no images.`);
