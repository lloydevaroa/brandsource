// Imports Trends products into Supabase (products, a Colour option group and
// its choices) and copies their images into BrandSource's own Storage bucket,
// so the storefront never links to or names Trends (API terms 4.1l, 3.1b).
// Catalogue data only: no pricing or stock (held back for V1, see build-brief.md).
//
// Reads trends-sample/products.json (run scripts/trends-sample.mjs first).
// Needs supabase/supplier-import.sql, product-details.sql and categories.sql run once.
//
// Usage: node --env-file=.env.local scripts/trends-import.mjs [--dry-run] [--codes 107658,100580]
// --codes imports only those product codes, leaving the rest of products.json untouched
// (a full run re-upserts every product and re-copies every image).
// Trends Data is confidential: never commit trends-sample/.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { NEW_CATEGORIES, mapProduct, slugify } from "./lib/trends-map.mjs";
import { categoriesMerge, categoriesSame, overridesFor, reconcile, sendReviewDigest } from "./lib/overrides.mjs";

const DRY = process.argv.includes("--dry-run");
const codesArg = process.argv.indexOf("--codes");
const ONLY = codesArg > -1 ? new Set(process.argv[codesArg + 1].split(",").map((c) => c.trim())) : null;
const BUCKET = "product-images";
const raw = JSON.parse(await readFile(new URL("../trends-sample/products.json", import.meta.url)));
const items = (Array.isArray(raw) ? raw : raw.products)
  .filter((p) => !ONLY || ONLY.has(String(p.code)))
  .map(mapProduct);

const slugs = items.map((i) => i.row.slug);
if (new Set(slugs).size !== slugs.length) throw new Error("Duplicate slugs in import: " + slugs.join(", "));

if (DRY) {
  for (const i of items) {
    console.log(`${i.row.slug} [${i.row.supplier_code}] active=${i.row.active} colours=${i.colours.length} images=${i.images.length}`);
    console.log(`  categories: ${i.categories.join(", ") || "(none mapped)"}`);
    console.log(`  ${i.row.short_description}`);
    console.log(`  details: ${i.details.features.length} features, ${i.details.specifications.length} specs, ${i.details.materials.length} materials, template=${i.templateSrc ? "yes" : "no"}`);
  }
  console.log(`\nDry run: ${items.length} products, nothing written.`);
  process.exit(0);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

// Tag every product with its supplier row (supabase/suppliers.sql). Tolerates the
// migration not being run yet by leaving supplier_id unset.
const { data: supplierRow } = await db.from("suppliers").select("id").eq("slug", "trends").maybeSingle();
const supplierId = supplierRow?.id ?? null;

// Never overwrites an existing category.
const { data: tradeShow, error: tradeShowErr } = await db.from("categories").select("id").eq("slug", "trade-show-and-events").single();
if (tradeShowErr) throw tradeShowErr;
const { error: newCatErr } = await db
  .from("categories")
  .upsert(NEW_CATEGORIES.map((c) => ({ ...c, parent_id: tradeShow.id })), { onConflict: "slug", ignoreDuplicates: true });
if (newCatErr) throw newCatErr;

const { error: bucketErr } = await db.storage.createBucket(BUCKET, { public: true });
if (bucketErr && !/already exists/i.test(bucketErr.message)) throw bucketErr;

async function copyImage(code, img) {
  const link = img.link.trim();
  const src = link.startsWith("//") ? `https:${link}` : link;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image ${src}: HTTP ${res.status}`);
  const path = `trends/${code}/${img.name}`;
  const { error } = await db.storage.from(BUCKET).upload(path, await res.arrayBuffer(), {
    contentType: res.headers.get("content-type") ?? "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function copyTemplate(code, link) {
  const src = encodeURI(link.startsWith("//") ? `https:${link}` : link);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Template ${src}: HTTP ${res.status}`);
  const path = `trends/${code}/branding-template.pdf`;
  const { error } = await db.storage.from(BUCKET).upload(path, await res.arrayBuffer(), {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const reviewChanges = [];

for (const { row, colours, images, details, templateSrc, categories } of items) {
  const urls = [];
  for (const img of images) urls.push(await copyImage(row.supplier_code, img));
  if (templateSrc) {
    // A template the supplier won't serve shouldn't block the product.
    try {
      details.template_url = await copyTemplate(row.supplier_code, templateSrc);
    } catch (e) {
      console.warn(`  (no branding template for ${row.slug}: ${e.message})`);
    }
  }

  // Fields the team has edited on the Master data page are left alone; the supplier's new value is recorded for review.
  const { data: known } = await db.from("products").select("id").eq("supplier", "trends").eq("supplier_code", row.supplier_code).maybeSingle();
  const overrides = known ? await overridesFor(db, known.id) : new Map();
  const payload = { ...row };
  if (overrides.has("description")) {
    await reconcile(db, reviewChanges, { productId: known.id, label: row.name, field: "description", override: overrides.get("description"), supplierNow: row.short_description });
    delete payload.short_description;
  }

  const { data: product, error } = await db
    .from("products")
    .upsert(
      { ...payload, ...(supplierId ? { supplier_id: supplierId } : {}), example_image_urls: urls, product_details: details },
      { onConflict: "supplier,supplier_code" },
    )
    .select("id")
    .single();
  if (error) throw error;

  // Insert only (never delete), so categories assigned by hand survive a re-sync.
  if (overrides.has("categories")) {
    await reconcile(db, reviewChanges, {
      productId: product.id,
      label: row.name,
      field: "categories",
      override: overrides.get("categories"),
      supplierNow: [...categories].sort(),
      isSame: categoriesSame,
      merge: categoriesMerge,
    });
  } else if (categories.length) {
    const { data: cats, error: catErr } = await db.from("categories").select("id, slug").in("slug", categories);
    if (catErr) throw catErr;
    const { error: linkErr } = await db
      .from("product_categories")
      .upsert(cats.map((c) => ({ product_id: product.id, category_id: c.id })), { onConflict: "product_id,category_id", ignoreDuplicates: true });
    if (linkErr) throw linkErr;
  }

  if (colours.length) {
    const { data: group, error: gErr } = await db
      .from("option_groups")
      .upsert({ product_id: product.id, key: "colour", label: "Colour", selection: "single", required: true }, { onConflict: "product_id,key" })
      .select("id")
      .single();
    if (gErr) throw gErr;
    const { error: cErr } = await db.from("option_choices").upsert(
      colours.map((label, n) => ({ option_group_id: group.id, key: slugify(label), label, price_delta: 0, sort_order: n })),
      { onConflict: "option_group_id,key" },
    );
    if (cErr) throw cErr;
  }
  console.log(`Imported ${row.slug} (${urls.length} images, ${colours.length} colours)`);
}
console.log(`\nDone: ${items.length} products.`);
await sendReviewDigest(db, reviewChanges);
