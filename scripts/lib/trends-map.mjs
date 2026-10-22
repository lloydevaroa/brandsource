// Shared Trends mapping: raw Trends product -> BrandSource rows, used by trends-import.mjs
// and trends-backfill.mjs. Pure functions, no I/O. Trends Data is confidential: never commit it.

export const MAX_IMAGES = 8;

export const slugify = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const cleanColour = (s) => s.trim().replace(/\.$/, "").trim();

export function shortDescription(text) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= 200) return t;
  const cut = t.slice(0, 200);
  return cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))) .trim();
}

export const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export function mapDetails(p) {
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
export const CATEGORY_MAP = {
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
    "2-1": "event-accessories", // stubby and can holders
    "2-14": "event-accessories", // key rings
    "1-14": "tote-bags", // conference bags
    "1-2": "cooler-bags",
    "10-5": "umbrellas",
  },
  prefix: { "13-": "pens", "4-": "drinkware", "9-": "caps-and-hats" },
};

// Storefront categories this importer places products into that categories.sql
// doesn't create. Created under Trade Show & Events on a real run, insert only.
export const NEW_CATEGORIES = [
  { slug: "clipboards", name: "Clipboards", sort_order: 180 },
  { slug: "caps-and-hats", name: "Caps & Hats", sort_order: 190 },
  { slug: "umbrellas", name: "Umbrellas", sort_order: 200 },
  { slug: "cooler-bags", name: "Cooler Bags", sort_order: 210 },
  { slug: "drinkware", name: "Drinkware", sort_order: 220 },
  { slug: "backpacks-and-belt-bags", name: "Backpacks & Belt Bags", sort_order: 230 },
  { slug: "blankets-and-cushions", name: "Blankets & Cushions", sort_order: 240 },
  { slug: "towels", name: "Towels", sort_order: 250 },
  { slug: "socks-and-apparel", name: "Socks & Apparel", sort_order: 260 },
  { slug: "phone-and-desk-accessories", name: "Phone & Desk Accessories", sort_order: 270 },
  { slug: "plush-toys-and-novelties", name: "Plush Toys & Novelties", sort_order: 280 },
  { slug: "sports-balls", name: "Sports Balls", sort_order: 290 },
];

// Trends files all its signage and display products under one category (7-7), so
// those are placed by product name instead. First matching rule per product.
export const SIGNAGE_RULES = [
  [/tablecloth/i, ["table-covers"]],
  [/flag/i, ["flags"]],
  [/bannerstand/i, ["banner-stands", "trade-show-displays", "banners-and-displays"]],
  [/pull-up banner|banner stand/i, ["banner-stands", "banners-and-displays"]],
  [/display wall|counter|lightbox/i, ["trade-show-displays", "banners-and-displays"]],
];

// Placed by product name, on top of any category-number match.
export const NAME_RULES = [
  [/playing cards/i, ["cards"]],
  [/ice bucket/i, ["event-accessories"]],
  [/clipboard/i, ["clipboards"]],
  [/belt bag|travel bag|crossbody|sling|running belt|backpack/i, ["backpacks-and-belt-bags"]],
  [/blanket|cushion/i, ["blankets-and-cushions"]],
  [/towel/i, ["towels"]],
  [/socks|jumper/i, ["socks-and-apparel"]],
  [/phone wallet|pencil case|drawing set/i, ["phone-and-desk-accessories"]],
  [/plush|rubber duck/i, ["plush-toys-and-novelties"]],
  [/(rugby|league|afl|soccer|touch) ball|netball|volleyball/i, ["sports-balls"]],
  [/straw/i, ["drinkware"]],
  [/serving tray|lunch box/i, ["event-accessories"]],
];

export function categorySlugs(p) {
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

export function mapProduct(p) {
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

// Pricing: Trends cost data -> supplier pricing rows, and the interim selling price.
export function mapPricing(p) {
  const pr = p.pricing?.[0];
  if (!pr) return null;
  return {
    code: String(p.code),
    name: p.name,
    summary: {
      price_type: clean(pr.type),
      price_basis: clean(pr.primary_price_description),
      orderable_below_moq: pr.less_than_moq === "Y",
      pricing_comment: clean(pr.pricing_comment),
      supplier_updated_at: p.last_updated ? new Date(p.last_updated.replace(" ", "T") + "Z").toISOString() : null,
    },
    breaks: (pr.prices ?? []).map((b) => ({ min_qty: b.quantity, unit_cost: b.price })),
    extras: (pr.additional_costs ?? []).map((c) => ({
      supplier_charge_id: c.id,
      kind: c.type,
      branding_option: clean(c.branding_option),
      branding_area: clean(c.branding_area),
      description: clean(c.description),
      unit_cost: c.unit_price ?? 0,
      setup_cost: c.setup_price ?? c.setup ?? 0,
    })),
  };
}

export const SELL_MARKUP_PCT = 50; // cost plus 50%, matching The Collateral Company (8 Oct 2026)

export const cents = (n) => Math.round(n * 100) / 100;

// Up only, never down. Bands on the marked-up price (ex-GST):
//   under $1        nearest $0.05          0.77  -> 0.80
//   $1 to under $10 nearest $0.05          2.48  -> 2.50
//   $10 to $100     next x.95              29.60 -> 29.95
//   $100 to $1,000  next price ending 4.95 or 9.95   432.86 -> 434.95
//   $1,000 and up   next whole price ending in 9     4456.58 -> 4459
export function roundUp(p) {
  const x = cents(p);
  if (x < 10) return cents(Math.ceil(x * 20 - 1e-9) / 20);
  if (x < 100) return cents(Math.ceil(x - 0.95 - 1e-9) + 0.95);
  if (x < 1000) return cents(Math.ceil((x + 0.05) / 5 - 1e-9) * 5 - 0.05);
  return Math.ceil((x + 1) / 10 - 1e-9) * 10 - 1;
}
