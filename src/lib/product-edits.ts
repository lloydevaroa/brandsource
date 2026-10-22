import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile, type Profile } from "@/lib/supabase/profile";
import { UserFacingError } from "@/lib/error-log";
import type { OverrideField } from "@/lib/master-data";

/**
 * Shared by the Master data edit panel and the CSV bulk edit: one place that validates an edit,
 * keeps the supplier's value in product_overrides, writes the live value and logs it.
 * Server only.
 */

export type Value = string | number | string[] | null;
export type Supabase = ReturnType<typeof createServiceSupabase>;
export type ProductRow = { id: string; supplier: string | null; short_description: string; unit_price: number | string | null };
export type ProductEdit = { slug: string; description?: string; rrp?: number; categories?: string[] };

export const FIELD_LABEL: Record<OverrideField, string> = {
  description: "Description",
  rrp: "RRP",
  categories: "Categories",
};

export const same = (a: Value, b: Value) => JSON.stringify(a) === JSON.stringify(b);

export async function requireStaff(): Promise<Profile> {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new UserFacingError("You need a staff account to edit products.");
  }
  return profile;
}

export async function loadProduct(supabase: Supabase, slug: string): Promise<ProductRow> {
  const { data, error } = await supabase
    .from("products")
    .select("id, supplier, short_description, unit_price")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new UserFacingError("That product no longer exists.");
  return data as ProductRow;
}

async function liveCategories(supabase: Supabase, productId: string): Promise<string[]> {
  const { data: links, error } = await supabase.from("product_categories").select("category_id").eq("product_id", productId);
  if (error) throw error;
  const ids = (links ?? []).map((l) => l.category_id as string);
  if (ids.length === 0) return [];
  const { data: cats, error: cErr } = await supabase.from("categories").select("slug").in("id", ids);
  if (cErr) throw cErr;
  return (cats ?? []).map((c) => c.slug as string).sort();
}

export async function liveValue(supabase: Supabase, p: ProductRow, field: OverrideField): Promise<Value> {
  if (field === "description") return p.short_description;
  if (field === "rrp") return p.unit_price === null ? null : Number(p.unit_price);
  return liveCategories(supabase, p.id);
}

/** Writes the live value customers see. */
async function writeLive(supabase: Supabase, p: ProductRow, field: OverrideField, value: Value) {
  if (field === "description") {
    const { error } = await supabase.from("products").update({ short_description: String(value ?? "") }).eq("id", p.id);
    if (error) throw error;
  } else if (field === "rrp") {
    const { error } = await supabase.from("products").update({ unit_price: value }).eq("id", p.id);
    if (error) throw error;
  } else {
    const slugs = (value as string[]) ?? [];
    const { data: cats, error: cErr } = await supabase.from("categories").select("id, slug").in("slug", slugs);
    if (cErr) throw cErr;
    const { error: dErr } = await supabase.from("product_categories").delete().eq("product_id", p.id);
    if (dErr) throw dErr;
    if (cats && cats.length) {
      const { error } = await supabase
        .from("product_categories")
        .insert(cats.map((c) => ({ product_id: p.id, category_id: c.id })));
      if (error) throw error;
    }
  }
}

export async function logChange(
  supabase: Supabase,
  staff: Profile,
  productId: string,
  field: OverrideField,
  kind: "edit" | "revert" | "keep" | "supplier_change",
  oldValue: Value,
  newValue: Value,
) {
  const { error } = await supabase.from("product_change_log").insert({
    product_id: productId,
    field,
    kind,
    old_value: oldValue,
    new_value: newValue,
    changed_by: staff.id,
    changed_by_name: staff.full_name || staff.email || "Staff",
  });
  if (error) overridesMissing(error);
}

export function refresh() {
  revalidatePath("/admin/master-data");
  // Products and categories are cached for 60s; refresh so an edit shows straight away.
  revalidatePath("/", "layout");
}

export function overridesMissing(error: { message: string } | null) {
  if (error && /product_overrides|product_change_log/.test(error.message)) {
    throw new UserFacingError("Editing is switched off until supabase/product-overrides.sql has been run on this database.");
  }
  if (error) throw error;
}

/** Validates an edit and returns the fields to change. Throws a message staff can read as-is. */
export async function parseWanted(supabase: Supabase, edit: ProductEdit): Promise<[OverrideField, Value][]> {
  const wanted: [OverrideField, Value][] = [];
  if (edit.description !== undefined) {
    const text = edit.description.trim();
    if (!text) throw new UserFacingError("The description can't be empty.");
    if (text.length > 1000) throw new UserFacingError("Keep the description under 1,000 characters.");
    wanted.push(["description", text]);
  }
  if (edit.rrp !== undefined) {
    if (!Number.isFinite(edit.rrp) || edit.rrp <= 0 || edit.rrp > 100000) {
      throw new UserFacingError("The RRP needs to be a price above $0 (ex GST).");
    }
    wanted.push(["rrp", Math.round(edit.rrp * 100) / 100]);
  }
  if (edit.categories !== undefined) {
    const slugs = [...new Set(edit.categories)].sort();
    if (slugs.length === 0) throw new UserFacingError("Pick at least one category, or the website leaves the product out.");
    const { data: found, error } = await supabase.from("categories").select("slug").in("slug", slugs).eq("active", true);
    if (error) throw error;
    if ((found ?? []).length !== slugs.length) throw new UserFacingError("One of those categories no longer exists.");
    wanted.push(["categories", slugs]);
  }
  return wanted;
}

/** Applies validated edits. Returns the fields that actually changed. */
export async function applyFields(
  supabase: Supabase,
  staff: Profile,
  product: ProductRow,
  wanted: [OverrideField, Value][],
): Promise<OverrideField[]> {
  const isTrends = product.supplier === "trends";
  const changed: OverrideField[] = [];
  for (const [field, next] of wanted) {
    const current = await liveValue(supabase, product, field);
    if (same(current, next)) continue;

    const { data: existing, error: oErr } = await supabase
      .from("product_overrides")
      .select("id, supplier_value")
      .eq("product_id", product.id)
      .eq("field", field)
      .maybeSingle();
    overridesMissing(oErr);

    // Editing back to exactly what the supplier sends is a revert, not an override.
    const backToSupplier = existing && existing.supplier_value !== null && same(existing.supplier_value as Value, next);

    if (isTrends && !backToSupplier) {
      const row = {
        product_id: product.id,
        field,
        // Kept from the first edit; imports update it if the supplier changes later.
        supplier_value: existing ? existing.supplier_value : current,
        edited_by: staff.id,
        edited_at: new Date().toISOString(),
        needs_review: false,
        review_note: null,
      };
      const { error } = await supabase.from("product_overrides").upsert(row, { onConflict: "product_id,field" });
      overridesMissing(error);
    } else if (existing && backToSupplier) {
      const { error } = await supabase.from("product_overrides").delete().eq("id", existing.id);
      if (error) throw error;
    }

    await writeLive(supabase, product, field, next);
    await logChange(supabase, staff, product.id, field, backToSupplier ? "revert" : "edit", current, next);
    changed.push(field);
  }
  return changed;
}

/** Puts the supplier's value back on the live website and drops the override. */
export async function applyRevert(supabase: Supabase, staff: Profile, product: ProductRow, field: OverrideField) {
  const { data: o, error } = await supabase
    .from("product_overrides")
    .select("id, supplier_value")
    .eq("product_id", product.id)
    .eq("field", field)
    .maybeSingle();
  overridesMissing(error);
  if (!o || o.supplier_value === null) throw new UserFacingError("There is no supplier value to go back to for that field.");

  const current = await liveValue(supabase, product, field);
  await writeLive(supabase, product, field, o.supplier_value as Value);
  const { error: dErr } = await supabase.from("product_overrides").delete().eq("id", o.id);
  if (dErr) throw dErr;
  await logChange(supabase, staff, product.id, field, "revert", current, o.supplier_value as Value);
}

export function listFields(fields: OverrideField[]) {
  const names = fields.map((f) => FIELD_LABEL[f]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
