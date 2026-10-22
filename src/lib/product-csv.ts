import { UserFacingError } from "@/lib/error-log";
import type { Profile } from "@/lib/supabase/profile";
import type { OverrideField } from "@/lib/master-data";
import {
  applyFields,
  applyRevert,
  loadProduct,
  overridesMissing,
  parseWanted,
  same,
  type ProductEdit,
  type Supabase,
  type Value,
} from "@/lib/product-edits";

/** What the staff member typed in the editable columns of one CSV row. Blank cells are left out. */
export type CsvRow = { line: number; slug: string; description?: string; categories?: string; rrp?: string };

export type PlannedChange = {
  field: OverrideField;
  /** revert: the field goes back to the supplier's value. */
  kind: "edit" | "revert";
  from: Value;
  to: Value;
  /** The cell said [supplier], rather than holding a value that happens to match it. */
  viaToken?: boolean;
};

export type PlanItem = { line: number; slug: string; name: string; changes: PlannedChange[]; errors: string[]; warnings: string[] };

export const REVERT_TOKEN = "[supplier]";
export const MAX_ROWS = 1000;
export const MAX_APPLY = 300;

const chunk = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

type Loaded = { id: string; slug: string; name: string; supplier: string | null; short_description: string; unit_price: number | string | null };

/** Works out what each row would change, without writing anything. */
export async function planCsv(supabase: Supabase, rows: CsvRow[]): Promise<PlanItem[]> {
  if (rows.length === 0) throw new UserFacingError("The file has no product rows.");
  if (rows.length > MAX_ROWS) throw new UserFacingError(`Keep each upload to ${MAX_ROWS} products or fewer.`);

  const slugs = [...new Set(rows.map((r) => r.slug).filter(Boolean))];

  const products = new Map<string, Loaded>();
  for (const part of chunk(slugs, 100)) {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, supplier, short_description, unit_price")
      .in("slug", part);
    if (error) throw error;
    for (const p of (data ?? []) as Loaded[]) products.set(p.slug, p);
  }
  const ids = [...products.values()].map((p) => p.id);

  const { data: catRows, error: catErr } = await supabase.from("categories").select("id, slug, name, active");
  if (catErr) throw catErr;
  const cats = (catRows ?? []) as { id: string; slug: string; name: string; active: boolean }[];
  const catById = new Map(cats.map((c) => [c.id, c]));

  const liveCats = new Map<string, string[]>();
  const overrides = new Map<string, Value>(); // `${product_id}:${field}` -> supplier value
  for (const part of chunk(ids, 100)) {
    const { data: links, error } = await supabase.from("product_categories").select("product_id, category_id").in("product_id", part);
    if (error) throw error;
    for (const l of links ?? []) {
      const slug = catById.get(l.category_id)?.slug;
      if (slug) liveCats.set(l.product_id, [...(liveCats.get(l.product_id) ?? []), slug]);
    }
    const { data: ovs, error: oErr } = await supabase.from("product_overrides").select("product_id, field, supplier_value").in("product_id", part);
    overridesMissing(oErr);
    for (const o of ovs ?? []) overrides.set(`${o.product_id}:${o.field}`, o.supplier_value as Value);
  }

  // Supplier cost, only to warn about prices below cost or under the usual markup.
  const cost = new Map<string, number>();
  const costIds = rows.filter((r) => r.rrp).map((r) => products.get(r.slug)?.id).filter((x): x is string => Boolean(x));
  for (const part of chunk([...new Set(costIds)], 100)) {
    const { data } = await supabase.from("product_price_breaks").select("product_id, min_qty, unit_cost").in("product_id", part).order("min_qty", { ascending: true });
    for (const b of data ?? []) if (!cost.has(b.product_id)) cost.set(b.product_id, Number(b.unit_cost));
  }

  const firstLine = new Map<string, number>();
  return rows.map((row): PlanItem => {
    const item: PlanItem = { line: row.line, slug: row.slug, name: row.slug, changes: [], errors: [], warnings: [] };
    if (!row.slug) {
      item.errors.push("There is no slug on this row.");
      return item;
    }
    if (firstLine.has(row.slug)) {
      item.errors.push(`This product is already on line ${firstLine.get(row.slug)} of the file.`);
      return item;
    }
    firstLine.set(row.slug, row.line);

    const p = products.get(row.slug);
    if (!p) {
      item.errors.push("No product has this slug.");
      return item;
    }
    item.name = p.name;
    const isTrends = p.supplier === "trends";
    const live: Record<OverrideField, Value> = {
      description: p.short_description,
      rrp: p.unit_price === null ? null : Number(p.unit_price),
      categories: [...(liveCats.get(p.id) ?? [])].sort(),
    };
    const supplierOf = (field: OverrideField): Value | undefined => overrides.get(`${p.id}:${field}`);

    const add = (field: OverrideField, to: Value, viaToken = false) => {
      if (same(live[field], to)) return;
      const sup = supplierOf(field);
      item.changes.push({ field, kind: viaToken || (sup !== undefined && sup !== null && same(sup, to)) ? "revert" : "edit", from: live[field], to, viaToken });
    };

    /** [supplier] in a cell. Returns true when it was handled. */
    const token = (field: OverrideField, cell: string | undefined) => {
      if (cell?.trim().toLowerCase() !== REVERT_TOKEN) return false;
      const sup = supplierOf(field);
      if (sup !== undefined && sup !== null) add(field, sup, true);
      else if (!isTrends) item.errors.push(`${field}: this product has no supplier value to go back to.`);
      // A Trends product with no edit already shows the supplier's value, so there is nothing to do.
      return true;
    };

    if (row.description !== undefined && !token("description", row.description)) {
      const text = row.description.trim();
      if (text.length > 1000) item.errors.push("description: keep it under 1,000 characters.");
      else add("description", text);
    }

    if (row.rrp !== undefined && !token("rrp", row.rrp)) {
      const n = Number(row.rrp.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n <= 0 || n > 100000) {
        item.errors.push(`rrp: "${row.rrp}" isn't a price above $0.`);
      } else {
        const price = Math.round(n * 100) / 100;
        add("rrp", price);
        const c = cost.get(p.id);
        if (c) {
          if (price < c) item.warnings.push(`RRP $${price.toFixed(2)} is below the supplier cost $${c.toFixed(2)}.`);
          else if ((price - c) / c < 0.495) item.warnings.push(`RRP markup is ${Math.round(((price - c) / c) * 100)}%, under the usual 50%.`);
        }
      }
    }

    if (row.categories !== undefined && !token("categories", row.categories)) {
      const tokens = row.categories.split(/[|;]/).map((t) => t.trim()).filter(Boolean);
      const found: string[] = [];
      for (const t of tokens) {
        const lower = t.toLowerCase();
        const bySlug = cats.find((c) => c.slug.toLowerCase() === lower);
        const byName = cats.filter((c) => c.name.toLowerCase() === lower);
        const hit = bySlug ?? (byName.length === 1 ? byName[0] : null);
        if (!hit) {
          item.errors.push(
            byName.length > 1
              ? `categories: "${t}" matches more than one category, so use the slug instead (${byName.map((c) => c.slug).join(" or ")}).`
              : `categories: "${t}" isn't a category.`,
          );
        } else if (!hit.active) {
          item.errors.push(`categories: "${t}" is switched off.`);
        } else found.push(hit.slug);
      }
      if (tokens.length === 0) item.errors.push("categories: pick at least one, or the website leaves the product out.");
      else if (found.length === tokens.length) add("categories", [...new Set(found)].sort());
    }

    return item;
  });
}

export type ApplyOutcome = { products: number; fields: number; failed: { slug: string; message: string }[] };

/** Applies the rows that planned cleanly. Rows with errors are skipped, never half-applied. */
export async function applyPlan(supabase: Supabase, staff: Profile, plan: PlanItem[]): Promise<ApplyOutcome> {
  const todo = plan.filter((p) => p.errors.length === 0 && p.changes.length > 0);
  if (todo.length > MAX_APPLY) throw new UserFacingError(`That changes ${todo.length} products. Apply at most ${MAX_APPLY} at a time: split the file and upload it in parts.`);

  const out: ApplyOutcome = { products: 0, fields: 0, failed: [] };
  for (const group of chunk(todo, 8)) {
    await Promise.all(
      group.map(async (item) => {
        try {
          const product = await loadProduct(supabase, item.slug);
          const edit: ProductEdit = { slug: item.slug };
          let fields = 0;
          for (const c of item.changes) {
            if (c.viaToken) {
              await applyRevert(supabase, staff, product, c.field);
              fields++;
            } else if (c.field === "description") edit.description = c.to as string;
            else if (c.field === "rrp") edit.rrp = c.to as number;
            else edit.categories = c.to as string[];
          }
          const wanted = await parseWanted(supabase, edit);
          fields += (await applyFields(supabase, staff, product, wanted)).length;
          out.products++;
          out.fields += fields;
        } catch (e) {
          out.failed.push({ slug: item.slug, message: e instanceof UserFacingError ? e.message : "Something unexpected went wrong." });
          console.error(`[master-data csv] ${item.slug} failed`, e);
        }
      }),
    );
  }
  return out;
}
