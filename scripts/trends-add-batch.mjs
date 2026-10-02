// Adds N more Trends products (default 30) to trends-sample/products.json,
// skipping codes already in it. Spreads picks round-robin across the Trends
// categories the importer maps into storefront categories (CATEGORY_MAP).
// Read-only against Trends. trends-sample/ is gitignored (Trends Data is confidential).
//
// Usage: node --env-file=.env.local scripts/trends-add-batch.mjs [count]

import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://nz.api.trends.nz/api/v1";
const FILE = new URL("../trends-sample/products.json", import.meta.url);
const COUNT = Number(process.argv[2] ?? 30);
const SOURCES = ["3-4", "13-1", "13-2", "13-3", "1-1", "1-12", "1-16", "2-5", "3-9"];

const { TRENDS_API_TOKEN: token, TRENDS_API_USERNAME: user, TRENDS_API_PASSWORD: pass } = process.env;
const auth = token ? `Bearer ${token}` : `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path) => {
  await sleep(1500); // paced on purpose: speed is not a requirement
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  return res.json();
};
const unwrap = (j) => (Array.isArray(j) ? j : j.data ?? j);

const existing = JSON.parse(await readFile(FILE));
const have = new Set(existing.map((p) => String(p.code)));

const queues = [];
for (const cat of SOURCES) {
  const list = unwrap(await get(`/products.json?category_no=${cat}&page_size=40&page_no=1`).catch(() => []));
  const fresh = (list ?? []).filter((p) => !have.has(String(p.code)) && ["Normal", "New"].includes(p.status));
  console.log(`${cat}: ${list?.length ?? 0} listed, ${fresh.length} new`);
  if (fresh.length) queues.push(fresh);
}

const picked = [];
while (picked.length < COUNT && queues.some((q) => q.length)) {
  for (const q of queues) {
    const p = q.shift();
    if (p && !have.has(String(p.code)) && picked.length < COUNT) { have.add(String(p.code)); picked.push(p); }
  }
}

const added = [];
for (const p of picked) {
  const d = unwrap(await get(`/products/${encodeURIComponent(p.code)}.json`));
  added.push(Array.isArray(d) ? d[0] : d);
}
await writeFile(FILE, JSON.stringify([...existing, ...added], null, 2));
console.log(`Added ${added.length} (total ${existing.length + added.length})`);
for (const p of added) console.log(`- ${p.code} ${p.name} [${(p.categories ?? []).map((c) => c.num).join(",")}]`);
