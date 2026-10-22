// Keeps team edits (supabase/product-overrides.sql) safe from supplier imports.
// products.short_description / unit_price / product_categories hold the LIVE value. When a
// field has an override row, importers must not write it. Instead they record what the
// supplier sends now; if that differs from what the supplier sent when the team edited,
// the field is flagged "needs review" on the Master data page and the admins get an email.
//
// Every helper treats a missing product_overrides table as "no overrides", so importers
// still run on a database that hasn't had the migration yet.

const MISSING = /product_overrides|product_change_log|schema cache|does not exist/i;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const show = (field, v) => {
  if (v === null || v === undefined) return "nothing";
  if (field === "rrp") return `$${Number(v).toFixed(2)}`;
  if (Array.isArray(v)) return v.join(", ") || "no categories";
  const t = String(v);
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
};

/** Override rows for one product, keyed by field. */
export async function overridesFor(db, productId) {
  const { data, error } = await db.from("product_overrides").select("id, field, supplier_value").eq("product_id", productId);
  if (error) {
    if (MISSING.test(error.message)) return new Map();
    throw error;
  }
  return new Map((data ?? []).map((o) => [o.field, o]));
}

/**
 * Records the supplier's current value against an override. Pushes onto `changes` (for the
 * email digest) when it differs from what was recorded. `isSame` lets categories count a
 * supplier that still sends everything we recorded as unchanged.
 */
export async function reconcile(db, changes, { productId, label, field, override, supplierNow, isSame = same, merge = (_, now) => now }) {
  if (isSame(override.supplier_value, supplierNow)) return;
  const next = merge(override.supplier_value, supplierNow);
  const note = `The supplier now sends ${show(field, supplierNow)} (it was ${show(field, override.supplier_value)}).`;
  const { error } = await db
    .from("product_overrides")
    .update({ supplier_value: next, needs_review: true, review_note: note })
    .eq("id", override.id);
  if (error) throw error;
  const { error: lErr } = await db.from("product_change_log").insert({
    product_id: productId,
    field,
    kind: "supplier_change",
    old_value: override.supplier_value,
    new_value: supplierNow,
    changed_by: null,
    changed_by_name: null,
  });
  if (lErr) throw lErr;
  changes.push({ label, field, was: show(field, override.supplier_value), now: show(field, supplierNow) });
}

// Categories: a supplier that still sends every category we recorded is unchanged (hand-added
// categories in the recorded set don't count). New ones are flagged and added to the record.
export const categoriesSame = (recorded, now) => (now ?? []).every((s) => (recorded ?? []).includes(s));
export const categoriesMerge = (recorded, now) => [...new Set([...(recorded ?? []), ...(now ?? [])])].sort();

/** One email to the admins listing what the supplier changed under a team edit. Best effort. */
export async function sendReviewDigest(db, changes) {
  if (changes.length === 0) return;
  const lines = changes.map((c) => `- ${c.label}, ${c.field}: was ${c.was}, supplier now ${c.now}`);
  console.log(`\n${changes.length} team edit(s) now need review:\n${lines.join("\n")}`);

  const { RESEND_API_KEY: key, RESEND_FROM_EMAIL: from } = process.env;
  const site = process.env.SITE_URL ?? "https://brandsource-seven.vercel.app";
  if (!key) return console.log("(No RESEND_API_KEY here, so no email was sent. The flags still show on the Master data page.)");
  const { data: admins, error } = await db.from("profiles").select("email").eq("role", "admin").not("email", "is", null);
  if (error || !admins?.length) return console.log("(No admin email addresses found, so no email was sent.)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from ?? "BRANDSource <onboarding@resend.dev>",
      to: admins.map((a) => a.email),
      subject: `${changes.length} product edit${changes.length === 1 ? "" : "s"} need review: the supplier changed them`,
      text: `The supplier import found new values under edits the team made on the Master data page. Your edits are still live; nothing was overwritten.\n\n${lines.join("\n")}\n\nReview them: ${site}/admin/master-data?ed=review\n\nOpen each product and choose "Keep my edit" or "Use the supplier's new value".`,
    }),
  });
  console.log(res.ok ? "Review email sent to the admins." : `(Review email failed: ${res.status})`);
}
