// Pulls a small sample of Trends products (default 10) matching the
// Trade Show & Events groupings, and saves the raw API responses to
// trends-sample/ for inspection. Read-only: touches nothing on the site or
// in Supabase.
//
// Trends Data is Trends' confidential information under their API terms, so
// trends-sample/ is gitignored and must never be committed.
//
// Usage: node --env-file=.env.local scripts/trends-sample.mjs [count]
// Needs TRENDS_API_TOKEN (bearer), or TRENDS_API_USERNAME + TRENDS_API_PASSWORD (legacy basic auth).

import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://nz.api.trends.nz/api/v1";
const OUT = new URL("../trends-sample/", import.meta.url);
const COUNT = Number(process.argv[2] ?? 10);

// ImprintNow's tradeshow groups that Trends is likely to stock, in the order
// we want the sample spread across.
const GROUP_KEYWORDS = [
  ["Lanyards", /lanyard/i],
  ["Pens", /\bpens?\b/i],
  ["Tote Bags", /tote|bag/i],
  ["Buttons", /button|badge/i],
  ["ID Cards and Badge Holders", /card holder|badge holder|id card/i],
  ["Banner Stands", /banner/i],
  ["Flags", /flag/i],
  ["Trade Show Displays", /display|exhibition|trade ?show|event/i],
  ["Table Covers", /table/i],
];

function authHeader() {
  const { TRENDS_API_TOKEN: token, TRENDS_API_USERNAME: user, TRENDS_API_PASSWORD: pass } = process.env;
  if (token) return `Bearer ${token}`;
  if (user && pass) return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  throw new Error("Set TRENDS_API_TOKEN (or TRENDS_API_USERNAME and TRENDS_API_PASSWORD) in .env.local");
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

// Responses wrap their payload in `data`; be tolerant of either shape.
const unwrap = (json) => (Array.isArray(json) ? json : json.data ?? json);

function flattenCategories(nodes, parent = null, out = []) {
  for (const c of nodes ?? []) {
    out.push({ number: c.number, name: c.name, parent });
    flattenCategories(c.sub_categories, c.name, out);
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const health = await get("/health").catch((e) => ({ error: e.message }));
  console.log("Health:", JSON.stringify(health));

  const categoriesJson = await get("/categories.json");
  await writeFile(new URL("categories.json", OUT), JSON.stringify(categoriesJson, null, 2));
  const categories = flattenCategories(unwrap(categoriesJson));
  console.log(`Categories: ${categories.length} (saved to trends-sample/categories.json)`);

  // Match each ImprintNow group to Trends categories by name.
  const matches = GROUP_KEYWORDS.map(([group, re]) => ({
    group,
    categories: categories.filter((c) => re.test(c.name) || re.test(c.parent ?? "")),
  }));
  for (const m of matches) {
    console.log(`  ${m.group}: ${m.categories.map((c) => `${c.name} [${c.number}]`).join(", ") || "no match"}`);
  }

  // Take products round-robin across matched groups so the sample is varied.
  const picked = new Map();
  const perGroup = Math.max(1, Math.ceil(COUNT / matches.filter((m) => m.categories.length).length));
  for (const m of matches) {
    if (picked.size >= COUNT) break;
    for (const c of m.categories) {
      if (picked.size >= COUNT) break;
      const list = unwrap(await get(`/products.json?category_no=${encodeURIComponent(c.number)}&page_size=${perGroup}&page_no=1`));
      for (const p of list ?? []) {
        if (picked.size >= COUNT || [...picked.values()].filter((x) => x.group === m.group).length >= perGroup) break;
        if (!picked.has(p.code)) picked.set(p.code, { group: m.group, category: c.name, product: p });
      }
      if ([...picked.values()].filter((x) => x.group === m.group).length >= perGroup) break;
    }
  }

  // Full detail for each picked product.
  const sample = [];
  for (const [code, info] of picked) {
    const detail = unwrap(await get(`/products/${encodeURIComponent(code)}.json`));
    sample.push({ group: info.group, trends_category: info.category, ...(Array.isArray(detail) ? detail[0] : detail) });
  }
  await writeFile(new URL("products.json", OUT), JSON.stringify(sample, null, 2));

  console.log(`\nSample: ${sample.length} products (saved to trends-sample/products.json)`);
  for (const p of sample) {
    const breaks = p.pricing?.prices?.length ?? p.pricing?.[0]?.prices?.length ?? 0;
    console.log(
      `- [${p.group}] ${p.code} ${p.name} | colours: ${p.colours?.length ?? p.colours ?? 0}` +
        ` | images: ${p.images?.length ?? p.image_count ?? 0} | branding options: ${p.branding_options?.length ?? 0}` +
        ` | price breaks: ${breaks}`,
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
