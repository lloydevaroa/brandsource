/**
 * The filter menu under a category heading. Pure (no server imports): it runs
 * in the category page and ships only ids, labels and counts to the browser.
 *
 * Filters come from the data itself, so each category gets the ones that
 * actually tell its products apart: price bands worked out from that category's
 * own prices, the sub-categories when there are any, and the supplier
 * specification fields (Assembly, carry bag or case, lighting, country of
 * origin and so on) that differ between the products on the page.
 */

export type ProductSpec = { name: string; value: string };

export type FilterInput = {
  slug: string;
  unit_price: number | null;
  /** Slugs of the offered sub-categories this product sits in. */
  categories: string[];
  specs: ProductSpec[];
};

export type FilterOption = { id: string; label: string; count: number };
export type FilterGroup = { id: string; label: string; options: FilterOption[] };

export type FilterModel = {
  groups: FilterGroup[];
  /** Product slug to the `groupId~optionId` keys it satisfies. */
  facts: Record<string, string[]>;
};

const MAX_OPTIONS = 8; // a field with more distinct values than this is not a useful filter
const MAX_SPEC_GROUPS = 5;
const MAX_VALUE_LENGTH = 36; // longer than this is a sentence, not a value

// Supplier fields that are housekeeping or too messy to filter by.
const SKIP_SPECS = new Set([
  "fabric code",
  "fabric weight",
  "note",
  "notes",
  "pricing note",
  "impact aware collection",
  "sea freight",
  "production lead time",
]);

export const factKey = (groupId: string, optionId: string) => `${groupId}~${optionId}`;
export const groupOfKey = (key: string) => key.slice(0, key.indexOf("~"));

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Whole dollars without decimals, otherwise two. */
const dollars = (n: number) => `$${n % 1 === 0 ? n.toLocaleString("en-NZ") : n.toFixed(2)}`;

/** Round to 1, 2, 2.5, 5 or 10 times a power of ten, so price bands read cleanly. */
function niceNumber(x: number): number {
  const mag = 10 ** Math.floor(Math.log10(x));
  const n = x / mag;
  const step = [1, 2, 2.5, 5, 10].reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  return Number((step * mag).toPrecision(12));
}

type Band = { id: string; label: string; test: (price: number) => boolean };

/** Up to three bands split at the tertiles of this category's prices. */
function priceBands(prices: number[]): Band[] {
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (sorted.length < 4 || max < min * 1.5) return [];

  const cuts = [
    ...new Set([
      niceNumber(sorted[Math.floor(sorted.length / 3)]),
      niceNumber(sorted[Math.floor((sorted.length * 2) / 3)]),
    ]),
  ]
    .filter((c) => c > min && c <= max)
    .sort((a, b) => a - b);
  if (cuts.length === 0) return [];

  const bands: Band[] = [{ id: `u${cuts[0]}`, label: `Under ${dollars(cuts[0])}`, test: (p) => p < cuts[0] }];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [lo, hi] = [cuts[i], cuts[i + 1]];
    bands.push({
      id: `${lo}-${hi}`,
      label: `${dollars(lo)} to ${dollars(hi)}`,
      test: (p) => p >= lo && p < hi,
    });
  }
  const last = cuts[cuts.length - 1];
  bands.push({ id: `o${last}`, label: `${dollars(last)} and over`, test: (p) => p >= last });
  return bands;
}

function cleanValue(raw: string): string | null {
  if (raw.includes("|")) return null; // per-variant lists: "Ball Pen - 1mm | Rolling Ball Pen - 0.5mm"
  const first = raw.split(/[,;]/)[0].trim().replace(/[.:]+$/, "");
  return first && first.length <= MAX_VALUE_LENGTH ? first : null;
}

type Bucket = { label: string; slugs: Set<string> };

export function buildFilterModel(
  products: FilterInput[],
  categories: { slug: string; name: string }[] = [],
): FilterModel {
  const total = products.length;
  const facts: Record<string, Set<string>> = {};
  const groups: FilterGroup[] = [];
  if (total < 2) return { groups, facts: {} };

  const record = (slug: string, key: string) => (facts[slug] ??= new Set()).add(key);

  /** Turn buckets into a group. Options every product has cannot narrow anything, so they are dropped. */
  const addGroup = (id: string, label: string, buckets: Map<string, Bucket>, maxOptions = Infinity) => {
    const options = [...buckets.entries()]
      .filter(([, b]) => b.slugs.size > 0 && b.slugs.size < total)
      .map(([optionId, b]) => ({ id: optionId, label: b.label, count: b.slugs.size }));
    if (options.length === 0 || buckets.size > maxOptions) return false;
    for (const [optionId, b] of buckets) {
      if (!options.some((o) => o.id === optionId)) continue;
      for (const slug of b.slugs) record(slug, factKey(id, optionId));
    }
    groups.push({ id, label, options });
    return true;
  };

  // Category (sub-categories of the page)
  if (categories.length > 0) {
    const buckets = new Map<string, Bucket>(
      categories.map((c) => [c.slug, { label: c.name, slugs: new Set<string>() }]),
    );
    for (const p of products) for (const c of p.categories) buckets.get(c)?.slugs.add(p.slug);
    addGroup("category", "Category", buckets);
  }

  // Price
  const priced = products.filter((p): p is FilterInput & { unit_price: number } => p.unit_price != null);
  const bands = priceBands(priced.map((p) => p.unit_price));
  if (bands.length > 0) {
    const buckets = new Map<string, Bucket>(bands.map((b) => [b.id, { label: b.label, slugs: new Set<string>() }]));
    for (const p of priced) {
      const band = bands.find((b) => b.test(p.unit_price));
      if (band) buckets.get(band.id)?.slugs.add(p.slug);
    }
    addGroup("price", "Price (NZD)", buckets);
  }

  // Supplier specification fields
  const fields = new Map<string, { label: string; values: Map<string, Bucket>; slugs: Set<string> }>();
  const included = new Map<string, Bucket>(); // "Included" fields: carry bag, air pump...
  const features = new Map<string, Bucket>(); // "Yes" fields: flame retardant, BPA free...

  for (const p of products) {
    for (const spec of p.specs) {
      const name = spec.name.trim().replace(/\s+/g, " ");
      const key = name.toLowerCase();
      const value = spec.value.trim();
      if (!name || !value || SKIP_SPECS.has(key)) continue;

      const flag = value.toLowerCase();
      if (flag === "included" || flag === "yes") {
        const label = name.replace(/^individual\s+/i, "");
        const target = flag === "included" ? included : features;
        const bucket = target.get(label.toLowerCase()) ?? { label, slugs: new Set<string>() };
        bucket.slugs.add(p.slug);
        target.set(label.toLowerCase(), bucket);
        continue;
      }

      const cleaned = cleanValue(value);
      if (!cleaned) continue;
      const field = fields.get(key) ?? { label: name, values: new Map(), slugs: new Set<string>() };
      const bucket = field.values.get(cleaned.toLowerCase()) ?? { label: cleaned, slugs: new Set<string>() };
      bucket.slugs.add(p.slug);
      field.values.set(cleaned.toLowerCase(), bucket);
      field.slugs.add(p.slug);
      fields.set(key, field);
    }
  }

  const ranked = [...fields.entries()]
    .filter(([, f]) => f.slugs.size >= 2)
    .sort((a, b) => b[1].slugs.size - a[1].slugs.size || a[1].label.localeCompare(b[1].label));
  let added = 0;
  for (const [key, field] of ranked) {
    if (added >= MAX_SPEC_GROUPS) break;
    const buckets = new Map<string, Bucket>(
      [...field.values.values()].map((b) => [slugify(b.label), b] as [string, Bucket]),
    );
    if (addGroup(`spec-${slugify(key)}`, field.label, buckets, MAX_OPTIONS)) added++;
  }

  const flagBuckets = (m: Map<string, Bucket>) =>
    new Map<string, Bucket>([...m.values()].map((b) => [slugify(b.label), b] as [string, Bucket]));
  addGroup("included", "Included", flagBuckets(included), MAX_OPTIONS);
  addGroup("features", "Features", flagBuckets(features), MAX_OPTIONS);

  return {
    groups,
    facts: Object.fromEntries(Object.entries(facts).map(([slug, keys]) => [slug, [...keys]])),
  };
}

/** Within a group any selected option matches; across groups every group with a selection must match. */
export function matchesSelection(productFacts: string[] | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const have = new Set(productFacts ?? []);
  const byGroup = new Map<string, string[]>();
  for (const key of selected) {
    const g = groupOfKey(key);
    byGroup.set(g, [...(byGroup.get(g) ?? []), key]);
  }
  for (const keys of byGroup.values()) if (!keys.some((k) => have.has(k))) return false;
  return true;
}
