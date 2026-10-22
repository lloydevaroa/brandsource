"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile, type Profile } from "@/lib/supabase/profile";
import { reportError, UserFacingError } from "@/lib/error-log";
import type { OverrideField } from "@/lib/master-data";

export type SaveResult = { ok: true; message: string } | { ok: false; message: string };

export type HistoryEntry = {
  field: OverrideField;
  kind: "edit" | "revert" | "keep" | "supplier_change";
  oldValue: string | number | string[] | null;
  newValue: string | number | string[] | null;
  by: string;
  at: string;
};

const FIELD_LABEL: Record<OverrideField, string> = {
  description: "Description",
  rrp: "RRP",
  categories: "Categories",
};

type Value = string | number | string[] | null;
type Supabase = ReturnType<typeof createServiceSupabase>;

async function requireStaff(): Promise<Profile> {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new UserFacingError("You need a staff account to edit products.");
  }
  return profile;
}

type ProductRow = { id: string; supplier: string | null; short_description: string; unit_price: number | string | null };

async function loadProduct(supabase: Supabase, slug: string): Promise<ProductRow> {
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

async function liveValue(supabase: Supabase, p: ProductRow, field: OverrideField): Promise<Value> {
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

async function log(
  supabase: Supabase,
  staff: Profile,
  productId: string,
  field: OverrideField,
  kind: HistoryEntry["kind"],
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
  if (error) throw error;
}

const same = (a: Value, b: Value) => JSON.stringify(a) === JSON.stringify(b);

function refresh() {
  revalidatePath("/admin/master-data");
  // Products and categories are cached for 60s; refresh so an edit shows straight away.
  revalidatePath("/", "layout");
}

function overridesMissing(error: { message: string } | null) {
  if (error && /product_overrides|product_change_log/.test(error.message)) {
    throw new UserFacingError("Editing is switched off until supabase/product-overrides.sql has been run on this database.");
  }
  if (error) throw error;
}

export type ProductEdit = { slug: string; description?: string; rrp?: number; categories?: string[] };

export async function saveProductEdit(edit: ProductEdit): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, edit.slug);
    const isTrends = product.supplier === "trends";

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
      try {
        await log(supabase, staff, product.id, field, backToSupplier ? "revert" : "edit", current, next);
      } catch (e) {
        overridesMissing(e as { message: string });
      }
      changed.push(field);
    }

    if (changed.length === 0) return { ok: true, message: "Nothing to save: those values are already live." };
    refresh();
    return { ok: true, message: `Saved. ${listFields(changed)} updated on the live website.` };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't save the product", error: err, staffId: staff?.id }) };
  }
}

function listFields(fields: OverrideField[]) {
  const names = fields.map((f) => FIELD_LABEL[f]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Puts the supplier's value back on the live website and drops the override. */
export async function revertToSupplier(slug: string, field: OverrideField): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, slug);
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
    await log(supabase, staff, product.id, field, "revert", current, o.supplier_value as Value);
    refresh();
    return { ok: true, message: `Reverted. ${FIELD_LABEL[field]} is back to the supplier's value on the live website.` };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't revert to the supplier value", error: err, staffId: staff?.id }) };
  }
}

/** Staff have looked at a supplier change and want to keep their own edit. */
export async function keepMyEdit(slug: string, field: OverrideField): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, slug);
    const { error } = await supabase
      .from("product_overrides")
      .update({ needs_review: false, review_note: null })
      .eq("product_id", product.id)
      .eq("field", field);
    overridesMissing(error);
    const current = await liveValue(supabase, product, field);
    await log(supabase, staff, product.id, field, "keep", current, current);
    refresh();
    return { ok: true, message: `Done. Your ${FIELD_LABEL[field].toLowerCase()} stays live and the review flag is cleared.` };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't clear the review flag", error: err, staffId: staff?.id }) };
  }
}

export async function getProductHistory(slug: string): Promise<{ ok: true; entries: HistoryEntry[] } | { ok: false; message: string }> {
  try {
    await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, slug);
    const { data, error } = await supabase
      .from("product_change_log")
      .select("field, kind, old_value, new_value, changed_by_name, changed_at")
      .eq("product_id", product.id)
      .order("changed_at", { ascending: false })
      .limit(30);
    overridesMissing(error);
    return {
      ok: true,
      entries: (data ?? []).map((r) => ({
        field: r.field,
        kind: r.kind,
        oldValue: r.old_value,
        newValue: r.new_value,
        by: r.changed_by_name ?? "The supplier import",
        at: r.changed_at,
      })),
    };
  } catch (err) {
    return { ok: false, message: err instanceof UserFacingError ? err.message : "Couldn't load the change history." };
  }
}
