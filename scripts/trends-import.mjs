// Imports Trends products into Supabase (products, a Colour option group and
// its choices) and copies their images into BrandSource's own Storage bucket,
// so the storefront never links to or names Trends (API terms 4.1l, 3.1b).
// Catalogue data only: no pricing or stock (held back for V1, see build-brief.md).
//
// Reads trends-sample/products.json (run scripts/trends-sample.mjs first).
// Needs supabase/supplier-import.sql, product-details.sql and categories.sql run once.
//
// Usage: node --env-file=.env.local scripts/trends-import.mjs [--dry-run]
// Trends Data is confidential: never commit trends-sample/.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const BUCKET = "product-images";
const MAX_IMAGES = 8;

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cleanColour = (s) => s.trim().replace(/\.$/, "").trim();

function shortDescription(text) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= 200) return t;
  const cut = t.slice(0, 200);
  return cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))) .trim();
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function mapDetails(p) {
  const c = p.carton;
  return {
    features: (p.features ?? []).map(clean).filter(Boolean),
    specifications: (p.additional_specifications ?? []).map((x) => ({ name: clean(x.specification), value: clean(x.description) })),
    materials: (p.additional_materials ?? []).map((x) => ({ component: clean(x.component), material: clean(x.material) })),
    dimensions: (p.dimensions ?? []).map(clean).filter(Boolean),
    branding_options: (p.branding_options ?? []).map((x) => ({
      type: clean(x.print_type),
      areas: clean(x.print_description).split("|").map(clean).filter(Boolean),
    })),
    packaging: clean(p.packaging),
    carton: c ? { length_cm: c.length, width_cm: c.width, height_cm: c.height, weight_kg: Number(c.weight), quantity: c.quantity } : null,
    template_url: null,
    image_captions: (p.images ?? []).slice(0, MAX_IMAGES).map((i) => clean(i.caption)),
  };
}

// Trends category number -> our category slug (supabase/categories.sql). Exact
// match on the number, or a "13-" style prefix for a whole Trends parent.
// Unmapped Trends categories are ignored; add a line here to place more of them.
const CATEGORY_MAP = {
  exact: {
    "3-4": "lanyards",
    "2-5": "buttons",
    "3-9": "id-cards",
    "1-1": "tote-bags",
    "1-12": "tote-bags",
    "1-16": "tote-bags",
    "2-10": "tickets", // event wrist bands
    "7-3": "cards",
    "2-6": "event-accessories", // bar and counter mats
  },
  prefix: { "13-": "pens" },
};

// Trends files all its signage and display products under one category (7-7), so
// those are placed by product name instead. First matching rule per product.
const SIGNAGE_RULES = [
  [/tablecloth/i, ["table-covers"]],
  [/flag/i, ["flags"]],
  [/bannerstand/i, ["banner-stands", "trade-show-displays", "banners-and-displays"]],
  [/pull-up banner|banner stand/i, ["banner-stands", "banners-and-displays"]],
  [/display wall|counter|lightbox/i, ["trade-show-displays", "banners-and-displays"]],
];

// Placed by product name, on top of any category-number match.
const NAME_RULES = [
  [/playing cards/i, ["cards"]],
  [/ice bucket/i, ["event-accessories"]],
];

function categorySlugs(p) {
  const out = new Set();
  for (const c of p.categories ?? []) {
    const num = String(c.num ?? "");
    if (CATEGORY_MAP.exact[num]) out.add(CATEGORY_MAP.exact[num]);
    for (const [pre, slug] of Object.entries(CATEGORY_MAP.prefix)) if (num.startsWith(pre)) out.add(slug);
  }
  if ((p.categories ?? []).some((c) => String(c.num) === "7-7")) {
    const rule = SIGNAGE_RULES.find(([re]) => re.test(p.name));
    if (rule) for (const slug of rule[1]) out.add(slug);
  }
  for (const [re, slugs] of NAME_RULES) if (re.test(p.name)) for (const slug of slugs) out.add(slug);
  return [...out];
}

function mapProduct(p) {
  const colours = [...new Set(String(p.colours ?? "").split(",").map(cleanColour).filter(Boolean))];
  return {
    row: {
      slug: slugify(p.name),
      name: p.name,
      short_description: shortDescription(p.description),
      active: p.active === "Active" && ["Normal", "New"].includes(p.status),
      supplier: "trends",
      supplier_code: String(p.code),
      sort_order: 100,
      supplier_updated_at: p.last_updated ? new Date(p.last_updated.replace(" ", "T") + "Z").toISOString() : null,
      imported_at: new Date().toISOString(),
    },
    colours,
    categories: categorySlugs(p),
    images: (p.images ?? []).slice(0, MAX_IMAGES),
    details: mapDetails(p),
    templateSrc: p.product_wire ? clean(p.product_wire) : null,
  };
}

const raw = JSON.parse(await readFile(new URL("../trends-sample/products.json", import.meta.url)));
const items = (Array.isArray(raw) ? raw : raw.products).map(mapProduct);

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

  const { data: product, error } = await db
    .from("products")
    .upsert(
      { ...row, ...(supplierId ? { supplier_id: supplierId } : {}), example_image_urls: urls, product_details: details },
      { onConflict: "supplier,supplier_code" },
    )
    .select("id")
    .single();
  if (error) throw error;

  // Insert only (never delete), so categories assigned by hand survive a re-sync.
  if (categories.length) {
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
