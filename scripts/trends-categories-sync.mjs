// Mirrors Trends' own category tree into the storefront: each Trends parent becomes a
// top-level category and each Trends subcategory a child of it. Insert only, so existing
// categories (Trade Show & Events and its children) and anything renamed by hand are
// never touched. A category with no active products stays hidden on the storefront, so
// running this shows nothing until products are released.
//
// Reads trends-categories.csv (category_number, category, subcategory_number, subcategory),
// which sits in Clients/BRANDSource/, outside the repo. Needs supabase/categories-trends.sql
// run once. Safe to re-run.
//
// Slugs: parent = its name; child = parent slug + child name (so "bags-tote-bags" never
// clashes with the existing "tote-bags"). If a parent's slug is already taken by one of our
// own categories (Pens, Drinkware) it gets "-range". Slugs are visible in storefront URLs,
// so none of them name the supplier.
//
// Usage: node --env-file=.env.local scripts/trends-categories-sync.mjs [--dry-run] [--csv path]

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "./lib/trends-map.mjs";

const DRY = process.argv.includes("--dry-run");
const csvArg = process.argv.indexOf("--csv");
const CSV = csvArg > -1 ? process.argv[csvArg + 1] : new URL("../../trends-categories.csv", import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, n) => [h, (r[n] ?? "").trim()])));
}

const parents = new Map();
for (const r of parseCsv(await readFile(CSV, "utf8"))) {
  if (!r.subcategory_number || !r.subcategory) continue; // e.g. "Indent" has no named subcategory
  if (!parents.has(r.category_number)) parents.set(r.category_number, { num: r.category_number, name: r.category, children: [] });
  // Trends gives two brands one number (103-36: Kadi, Bodum), and products carry only the number,
  // so they share one category named after both.
  const kids = parents.get(r.category_number).children;
  const same = kids.find((c) => c.num === r.subcategory_number);
  if (same) same.name += ` & ${r.subcategory}`;
  else kids.push({ num: r.subcategory_number, name: r.subcategory });
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

let { data: existing, error: exErr } = await db.from("categories").select("id, slug, trends_num");
if (exErr && DRY) {
  console.warn(`(${exErr.message}: supabase/categories-trends.sql not run yet, planning against slugs only)\n`);
  ({ data: existing, error: exErr } = await db.from("categories").select("id, slug"));
}
if (exErr) throw new Error(`${exErr.message} (has supabase/categories-trends.sql been run?)`);
const taken = new Set(existing.map((c) => c.slug));
const byNum = new Map(existing.filter((c) => c.trends_num).map((c) => [c.trends_num, c]));

const plan = []; // { num, name, slug, parentNum, sort_order }
let order = 1000; // after Trade Show & Events (10)
for (const p of [...parents.values()].sort((a, b) => parseInt(a.num) - parseInt(b.num))) {
  let slug = byNum.get(p.num)?.slug ?? slugify(p.name);
  if (!byNum.has(p.num) && taken.has(slug)) slug = `${slug}-range`;
  taken.add(slug);
  plan.push({ num: p.num, name: p.name, slug, parentNum: null, sort_order: order });
  order += 10;
  p.children.forEach((c, n) => {
    let cslug = byNum.get(c.num)?.slug ?? `${slug}-${slugify(c.name)}`;
    if (!byNum.has(c.num) && taken.has(cslug)) cslug = `${cslug}-${c.num}`;
    taken.add(cslug);
    plan.push({ num: c.num, name: c.name, slug: cslug, parentNum: p.num, sort_order: (n + 1) * 10 });
  });
}

const fresh = plan.filter((c) => !byNum.has(c.num));
for (const c of fresh) console.log(`${c.parentNum ? "    " : ""}${c.name}  [${c.num}]  /category/${c.slug}`);
console.log(`\n${plan.length} categories in the Trends tree (${parents.size} parents), ${fresh.length} new, ${plan.length - fresh.length} already there.`);
if (DRY) { console.log("Dry run, nothing written."); process.exit(0); }

const check = (r) => { if (r.error) throw r.error; return r.data; };
const freshParents = fresh.filter((c) => !c.parentNum);
if (freshParents.length) {
  check(await db.from("categories").insert(freshParents.map((c) => ({ slug: c.slug, name: c.name, sort_order: c.sort_order, trends_num: c.num }))));
}
const parentIds = new Map(check(await db.from("categories").select("id, trends_num").not("trends_num", "is", null).like("trends_num", "%-0")).map((c) => [c.trends_num, c.id]));
const freshKids = fresh.filter((c) => c.parentNum);
if (freshKids.length) {
  check(await db.from("categories").insert(freshKids.map((c) => ({ slug: c.slug, name: c.name, parent_id: parentIds.get(c.parentNum), sort_order: c.sort_order, trends_num: c.num }))));
}
console.log(`Added ${freshParents.length} parents and ${freshKids.length} subcategories.`);
