// Imports the TLC Live banner and stretch fabric catalogue as SAMPLE products.
//
// Source: ../../tlc-catalogue/products.json and products/*.png (the vault folder
// next to this repo; images are cropped from TLC's Sept 2024 product guide and
// are deliberately not committed). Images are copied into the product-images
// Storage bucket under tlc/<slug>/, the same pattern as the Trends import.
//
// Every product is tagged with the TLC supplier (supabase/suppliers.sql, run it
// first). TLC's listing status there controls everything: Sample shows a badge,
// Live removes it, Withdrawn hides all of the products. No prices (quote only).
//
// Usage: node --env-file=.env.local scripts/tlc-import.mjs [--dry-run | --remove]
//   --remove  deletes every TLC product and its stored images (use if TLC declines)

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const REMOVE = process.argv.includes("--remove");
const BUCKET = "product-images";
const SUPPLIER = "tlc";
const ROOT = new URL("../../tlc-catalogue/", import.meta.url);

// Our categories, named the way customers say them. Created if missing; renaming
// or moving them later in the admin is safe, the importer never overwrites them.
const NEW_CATEGORIES = [
  { slug: "banners", name: "Banners", sort_order: 35 },
  { slug: "stretch-fabric-displays", name: "Stretch Fabric Displays", sort_order: 36 },
];

const CATEGORIES = {
  "tlc-tear-drop-wing-banners": ["banners", "flags"],
  "tlc-backpack-banners": ["banners", "flags"],
  "tlc-arch-banners": ["banners"],
  "tlc-banner-bases": ["banners"],
  "tlc-pull-up-banners": ["banners", "banner-stands"],
  "tlc-table-top-pull-up-banners": ["banners", "banner-stands"],
  "tlc-table-top-tear-drop-banners": ["banners"],
  "tlc-tifo-banners": ["banners"],
  "tlc-mesh-polyester-banners": ["banners"],
  "tlc-snap-lock-picture-frames": ["banners"],
  "tlc-backlit-poster-frames": ["banners"],
  "tlc-pull-out-banners": ["banners"],
  "tlc-vinyl-banners": ["banners"],
  "tlc-pop-up-banners": ["banners"],
  "tlc-run-through-banners": ["banners"],
  "tlc-stretch-fabric-displays": ["stretch-fabric-displays", "trade-show-displays"],
  "tlc-stretch-fabric-hanging": ["stretch-fabric-displays", "trade-show-displays"],
  "tlc-stretch-fabric-table-top": ["stretch-fabric-displays", "trade-show-displays"],
  "tlc-stretch-fabric-shelving": ["stretch-fabric-displays", "trade-show-displays"],
};

const DESCRIPTIONS = {
  "tlc-tear-drop-wing-banners": "Tear drop and wing feather banners in five shapes and three sizes, supplied with a carry case and your choice of base.",
  "tlc-backpack-banners": "Tear drop and wing banners worn on a backpack, for events and promotions on the move.",
  "tlc-arch-banners": "A 3m wide arch banner for entrances, finish lines and event frontages.",
  "tlc-banner-bases": "Cross, water, flat metal, screw-in and wall mount bases for tear drop and wing banners, indoors or out.",
  "tlc-pull-up-banners": "Roll-up banners in light weight and premium bases, supplied with a padded carry bag.",
  "tlc-table-top-pull-up-banners": "A3 and A4 mini pull-up banners for counters, reception and trade show tables.",
  "tlc-table-top-tear-drop-banners": "Mini tear drop banners with pole and base, great for table settings and counters.",
  "tlc-tifo-banners": "Large custom fabric banners for supporting teams at major sports events, any size.",
  "tlc-mesh-polyester-banners": "Wind-friendly recycled polyester mesh banners with reinforced edges and eyelets, any size.",
  "tlc-snap-lock-picture-frames": "A4 and A3 aluminium snap lock frames supplied with your full colour print.",
  "tlc-backlit-poster-frames": "Slim LED backlit poster frames in A4 and A3 for shop windows, malls and displays.",
  "tlc-pull-out-banners": "Handheld pull-out banners that open to 700 x 240mm, single or double sided.",
  "tlc-vinyl-banners": "Outdoor vinyl and vinyl mesh banners with welded edges and eyelets, any size.",
  "tlc-pop-up-banners": "Round, horizontal, vertical and three sided pop-up banners that fold flat into a carry case.",
  "tlc-run-through-banners": "Reusable fabric arch and rectangle run-through banners for sporting events.",
  "tlc-stretch-fabric-displays": "Portable stretch fabric displays in straight, arch, H-shape, wave, tower and snake shapes.",
  "tlc-stretch-fabric-hanging": "Single sided hanging circle, triangle and square stretch fabric displays.",
  "tlc-stretch-fabric-table-top": "Stretch fabric backdrop for a 6 or 8 foot table top.",
  "tlc-stretch-fabric-shelving": "Stretch fabric display with up to three shelves or an optional TV bracket.",
};

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
      short_description: DESCRIPTIONS[p.slug] ?? "",
      active: true,
      supplier: SUPPLIER,
      supplier_code: p.slug.replace(/^tlc-/, ""),
      min_order_qty: Number.isFinite(moq) && moq > 0 ? moq : 1,
      unit_price: null,
      sort_order: 200,
      imported_at: new Date().toISOString(),
    },
    images: p.images,
    categories: CATEGORIES[p.slug] ?? [],
    details: {
      features: (p.specs ?? []).map(clean).filter(Boolean),
      specifications: specs,
      materials: [],
      dimensions: Object.entries(p.sizes ?? {}).map(([g, s]) => `${g}: ${s.join(", ")}`),
      branding_options: [],
      packaging: "",
      carton: null,
      template_url: null,
      image_captions: p.images.map(() => ""),
    },
  };
}

const products = JSON.parse(await readFile(new URL("products.json", ROOT)));
const items = products.map(mapProduct);
for (const i of items) {
  if (!i.row.short_description) throw new Error(`No description for ${i.row.slug}`);
  if (!i.categories.length) throw new Error(`No category for ${i.row.slug}`);
}

if (DRY) {
  for (const i of items) {
    console.log(`${i.row.slug} moq=${i.row.min_order_qty} images=${i.images.length} categories=${i.categories.join(", ")}`);
  }
  console.log(`\nDry run: ${items.length} products, ${items.reduce((n, i) => n + i.images.length, 0)} images, nothing written.`);
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

const { error: bucketErr } = await db.storage.createBucket(BUCKET, { public: true });
if (bucketErr && !/already exists/i.test(bucketErr.message)) throw bucketErr;

// Create our new categories under Trade Show & Events; never overwrite existing ones.
const { data: parent, error: parentErr } = await db.from("categories").select("id").eq("slug", "trade-show-and-events").single();
if (parentErr) throw parentErr;
const { error: catErr } = await db
  .from("categories")
  .upsert(NEW_CATEGORIES.map((c) => ({ ...c, parent_id: parent.id })), { onConflict: "slug", ignoreDuplicates: true });
if (catErr) throw catErr;

for (const { row, images, categories, details } of items) {
  const urls = [];
  for (const rel of images) {
    const file = rel.split("/").pop();
    const path = `${SUPPLIER}/${row.slug}/${file}`;
    const { error } = await db.storage.from(BUCKET).upload(path, await readFile(new URL(rel, ROOT)), {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw error;
    urls.push(db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  const { data: product, error } = await db
    .from("products")
    .upsert(
      { ...row, supplier_id: supplier.id, example_image_urls: urls, product_details: details },
      { onConflict: "supplier,supplier_code" },
    )
    .select("id")
    .single();
  if (error) throw error;

  // Insert only (never delete), so categories changed by hand survive a re-run.
  const { data: cats, error: cErr } = await db.from("categories").select("id, slug").in("slug", categories);
  if (cErr) throw cErr;
  const { error: linkErr } = await db
    .from("product_categories")
    .upsert(cats.map((c) => ({ product_id: product.id, category_id: c.id })), { onConflict: "product_id,category_id", ignoreDuplicates: true });
  if (linkErr) throw linkErr;

  console.log(`Imported ${row.slug} (${urls.length} images, ${cats.length} categories)`);
}
console.log(`\nDone: ${items.length} products. TLC listing status is "${supplier.listing_status}" (change it at /admin/suppliers).`);
