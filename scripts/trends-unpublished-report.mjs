// Writes the list of Trends products that are not (fully) on the storefront, and why, so the
// team can decide to fix or leave each one out. Re-run it after any import; it rebuilds the
// whole note from the database plus the two local lists the backfill keeps.
//
// Reasons covered: set aside (extra-charge type we don't store), failed to import, imported but
// still hidden, live without a branding template, no selling price, in no category.
//
// Usage: node --env-file=.env.local scripts/trends-unpublished-report.mjs [--out path/to/note.md]
// Only product code, name and the reason go in the note. Nothing else from Trends is written.

import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : null; };
const OUT = arg("out") ? new URL(`file://${arg("out")}`) : new URL("../../trends-products-not-publishing.md", import.meta.url);
const local = (f) => readFile(new URL(`../trends-sample/${f}`, import.meta.url), "utf8").then(JSON.parse, () => ({}));

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

// Supabase caps a select at 1000 rows, so page through.
async function all(table, cols, filter = (q) => q, orderBy = "id") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const q = orderBy.split(",").reduce((acc, col) => acc.order(col), filter(db.from(table).select(cols)));
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const products = await all("products", "id, name, supplier_code, active, unit_price, imported_at, product_details", (q) => q.eq("supplier", "trends"));
const linked = new Set((await all("product_categories", "product_id, category_id", (q) => q, "product_id,category_id")).map((r) => r.product_id));
const skipped = await local("skipped-extra-costs.json");
const failed = await local("failed-imports.json");

const byCode = (a, b) => String(a.supplier_code).localeCompare(String(b.supplier_code), "en", { numeric: true });
const hidden = products.filter((p) => !p.active).sort(byCode);
const live = products.filter((p) => p.active);
const noTemplate = live.filter((p) => !p.product_details?.template_url).sort(byCode);
const noPrice = products.filter((p) => p.unit_price == null).sort(byCode);
const noCategory = products.filter((p) => !linked.has(p.id)).sort(byCode);

const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const table = (head, rows) => rows.length ? [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n") : "_None._";
const date = new Date().toISOString().slice(0, 10);

const setAsideRows = Object.entries(skipped).map(([code, v]) => [code, v.name, `Extra-charge type ${v.kinds.join("/")} (table only allows DO, DS, OE)`, v.found]);
const failedRows = Object.entries(failed).map(([code, v]) => [code, v.name, v.error, `${v.tries} (last ${v.last})`]);

const md = `---
category: project-note
status: open
date: ${date}
---

# BrandSource: Trends products not publishing

Generated ${date} by \`scripts/trends-unpublished-report.mjs\` (Trends products held: ${products.length}, live: ${live.length}). Rebuilt on every run, so edit decisions in the checklist below or in chat, not in the tables. Code and name only; everything else stays in Trends.

**For the team:** for each group, either fix the cause and re-import, or leave the products out of the range. Background on the extra-charge type: [[trends-products-set-aside]].

## Not imported at all

### Set aside: extra-charge type we don't store (${setAsideRows.length})
Mugs and bottles so far. Needs a decision on what the \`DCOE\` charge is and how it prices, then either allow the type and re-import or leave them out.

${table(["Code", "Name", "Reason", "Found"], setAsideRows)}

### Failed to import, retried each run (${failedRows.length})
Each run tries these again. A product that keeps failing needs a look.

${table(["Code", "Name", "Error", "Tries"], failedRows)}

## Imported but not on the storefront

### Hidden, not yet released (${hidden.length})
Imported with \`active = false\`. Normally released straight after a run; anything lingering here means the release step stopped or the product was held back.

${table(["Code", "Name", "Imported"], hidden.map((p) => [p.supplier_code, p.name, p.imported_at?.slice(0, 10)]))}

## Live but incomplete

### No branding template (${noTemplate.length})
Orderable, but customers get no template PDF. Ask Trends whether one exists, or leave as is.

${table(["Code", "Name"], noTemplate.map((p) => [p.supplier_code, p.name]))}

### No selling price (${noPrice.length})
Trends gave no cost data, so there is no price to show.

${table(["Code", "Name", "Live"], noPrice.map((p) => [p.supplier_code, p.name, p.active ? "yes" : "no"]))}

### In no category (${noCategory.length})
Only reachable by search. Needs a category mapped.

${table(["Code", "Name", "Live"], noCategory.map((p) => [p.supplier_code, p.name, p.active ? "yes" : "no"]))}

## Decisions

- [ ] Set-aside group: what \`DCOE\` means, then allow or drop
- [ ] Failed group: look at repeat failures
- [ ] Missing templates and prices: chase Trends or accept
`;
await writeFile(OUT, md);
console.log(`Wrote ${OUT.pathname}\nset aside ${setAsideRows.length}, failed ${failedRows.length}, hidden ${hidden.length}, no template ${noTemplate.length}, no price ${noPrice.length}, no category ${noCategory.length}`);
