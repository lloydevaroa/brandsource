// Imports Trends products into Supabase (products, a Colour option group and
// its choices) and copies their images into BrandSource's own Storage bucket,
// so the storefront never links to or names Trends (API terms 4.1l, 3.1b).
// Catalogue data only: no pricing or stock (held back for V1, see build-brief.md).
//
// Reads trends-sample/products.json (run scripts/trends-sample.mjs first).
// Needs supabase/supplier-import.sql run once.
//
// Usage: node --env-file=.env.local scripts/trends-import.mjs [--dry-run]
// Trends Data is confidential: never commit trends-sample/.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const BUCKET = "product-images";
const MAX_IMAGES = 4;

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cleanColour = (s) => s.trim().replace(/\.$/, "").trim();

function shortDescription(text) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= 200) return t;
  const cut = t.slice(0, 200);
  return cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))) .trim();
}

function mapProduct(p) {
  const colours = [...new Set(String(p.colours ?? "").split(",").map(cleanColour).filter(Boolean))];
  return {
    row: {
      slug: slugify(p.name),
      name: p.name,
      short_description: shortDescription(p.description),
      active: p.active === "Active" && p.status === "Normal",
      supplier: "trends",
      supplier_code: String(p.code),
      sort_order: 100,
      supplier_updated_at: p.last_updated ? new Date(p.last_updated.replace(" ", "T") + "Z").toISOString() : null,
      imported_at: new Date().toISOString(),
    },
    colours,
    images: (p.images ?? []).slice(0, MAX_IMAGES),
  };
}

const raw = JSON.parse(await readFile(new URL("../trends-sample/products.json", import.meta.url)));
const items = (Array.isArray(raw) ? raw : raw.products).map(mapProduct);

const slugs = items.map((i) => i.row.slug);
if (new Set(slugs).size !== slugs.length) throw new Error("Duplicate slugs in import: " + slugs.join(", "));

if (DRY) {
  for (const i of items) {
    console.log(`${i.row.slug} [${i.row.supplier_code}] active=${i.row.active} colours=${i.colours.length} images=${i.images.length}`);
    console.log(`  ${i.row.short_description}`);
  }
  console.log(`\nDry run: ${items.length} products, nothing written.`);
  process.exit(0);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

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

for (const { row, colours, images } of items) {
  const urls = [];
  for (const img of images) urls.push(await copyImage(row.supplier_code, img));

  const { data: product, error } = await db
    .from("products")
    .upsert({ ...row, example_image_urls: urls }, { onConflict: "supplier,supplier_code" })
    .select("id")
    .single();
  if (error) throw error;

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
