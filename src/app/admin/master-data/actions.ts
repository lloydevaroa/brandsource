"use server";

import { createServiceSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/profile";
import { reportError, UserFacingError } from "@/lib/error-log";
import type { OverrideField } from "@/lib/master-data";
import {
  FIELD_LABEL,
  applyFields,
  applyRevert,
  listFields,
  liveValue,
  loadProduct,
  logChange,
  overridesMissing,
  parseWanted,
  refresh,
  requireStaff,
  type ProductEdit,
} from "@/lib/product-edits";
import { applyPlan, planCsv, type CsvRow, type PlanItem } from "@/lib/product-csv";

export type SaveResult = { ok: true; message: string } | { ok: false; message: string };

export type HistoryEntry = {
  field: OverrideField;
  kind: "edit" | "revert" | "keep" | "supplier_change";
  oldValue: string | number | string[] | null;
  newValue: string | number | string[] | null;
  by: string;
  at: string;
};

export async function saveProductEdit(edit: ProductEdit): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, edit.slug);
    const wanted = await parseWanted(supabase, edit);
    const changed = await applyFields(supabase, staff, product, wanted);
    if (changed.length === 0) return { ok: true, message: "Nothing to save: those values are already live." };
    refresh();
    return { ok: true, message: `Saved. ${listFields(changed)} updated on the live website.` };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't save the product", error: err, staffId: staff?.id }) };
  }
}

/** Puts the supplier's value back on the live website and drops the override. */
export async function revertToSupplier(slug: string, field: OverrideField): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const product = await loadProduct(supabase, slug);
    await applyRevert(supabase, staff, product, field);
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
    await logChange(supabase, staff, product.id, field, "keep", current, current);
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

/** Bulk edit, step 1: what an uploaded file would change. Writes nothing. */
export async function previewCsvEdits(rows: CsvRow[]): Promise<{ ok: true; items: PlanItem[] } | { ok: false; message: string }> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    return { ok: true, items: await planCsv(createServiceSupabase(), rows) };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't read the file", error: err, staffId: staff?.id }) };
  }
}

/** Bulk edit, step 2: plans again from the same rows (never trusts the preview) and applies what is clean. */
export async function applyCsvEdits(rows: CsvRow[]): Promise<SaveResult> {
  let staff: Profile | null = null;
  try {
    staff = await requireStaff();
    const supabase = createServiceSupabase();
    const plan = await planCsv(supabase, rows);
    const skipped = plan.filter((p) => p.errors.length > 0).length;
    const out = await applyPlan(supabase, staff, plan);
    refresh();
    const parts = [`Applied ${out.fields} change${out.fields === 1 ? "" : "s"} across ${out.products} product${out.products === 1 ? "" : "s"}.`];
    if (skipped) parts.push(`${skipped} row${skipped === 1 ? " was" : "s were"} skipped because of errors.`);
    if (out.failed.length) {
      return { ok: false, message: `${parts.join(" ")} ${out.failed.length} failed: ${out.failed.slice(0, 5).map((f) => `${f.slug} (${f.message})`).join("; ")}.` };
    }
    return { ok: true, message: parts.join(" ") };
  } catch (err) {
    return { ok: false, message: await reportError({ area: "master-data", action: "Couldn't apply the file", error: err, staffId: staff?.id }) };
  }
}
