// Supplier visibility rules for the storefront. The supplier is internal; the
// only thing a customer can ever see is the badge text of a supplier that is
// still listed as a sample (e.g. "TLC sample"). Withdrawn or inactive suppliers
// hide all of their products.

export type SupplierListingStatus = "active" | "sample" | "withdrawn";

export type SupplierEmbed = {
  active: boolean;
  listing_status: SupplierListingStatus;
  public_label: string | null;
};

/** PostgREST returns a to-one embed as an object, but untyped it may look like an array. */
export function oneSupplier(s: SupplierEmbed | SupplierEmbed[] | null | undefined): SupplierEmbed | null {
  if (Array.isArray(s)) return s[0] ?? null;
  return s ?? null;
}

export const isSupplierHidden = (s: SupplierEmbed | null) =>
  s !== null && (!s.active || s.listing_status === "withdrawn");

export const sampleLabel = (s: SupplierEmbed | null): string | null =>
  s !== null && !isSupplierHidden(s) && s.listing_status === "sample"
    ? (s.public_label?.trim() || "Sample listing")
    : null;

/** Embed to add to a products select. */
export const SUPPLIER_EMBED = "supplier:suppliers ( active, listing_status, public_label )";

/**
 * True when a query failed only because supabase/suppliers.sql has not been run
 * yet. Callers retry without the supplier embed so the storefront keeps working.
 */
export const isMissingSupplierSchema = (message: string | undefined) =>
  /supplier|relationship/i.test(message ?? "");
