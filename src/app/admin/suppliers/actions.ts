"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

const CHANNELS = ["api", "email_po", "manual_portal"];
const STATUSES = ["active", "sample", "withdrawn"];

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const text = (formData: FormData, key: string) => {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
};

function fields(formData: FormData) {
  const name = text(formData, "name");
  if (!name) throw new Error("A supplier needs a name.");
  const channel = String(formData.get("channel") ?? "manual_portal");
  if (!CHANNELS.includes(channel)) throw new Error("Unknown channel.");
  const listing_status = String(formData.get("listing_status") ?? "active");
  if (!STATUSES.includes(listing_status)) throw new Error("Unknown listing status.");
  return {
    name,
    channel,
    listing_status,
    website: text(formData, "website"),
    contact_name: text(formData, "contact_name"),
    contact_email: text(formData, "contact_email"),
    contact_phone: text(formData, "contact_phone"),
    public_label: text(formData, "public_label"),
    notes: text(formData, "notes"),
    active: formData.get("active") === "on",
  };
}

// Products and categories are cached for 60s; refresh everything so a status
// change shows straight away.
const refresh = () => {
  revalidatePath("/admin/suppliers");
  revalidatePath("/", "layout");
};

export async function createSupplier(formData: FormData) {
  await requireStaffProfile();
  const f = fields(formData);
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("suppliers")
    .insert({ ...f, slug: slugify(f.name), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateSupplier(formData: FormData) {
  await requireStaffProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing supplier.");
  const f = fields(formData);
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("suppliers")
    .update({ ...f, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** One-click status change: Approve (active), Back to sample, Withdraw. */
export async function setSupplierListingStatus(formData: FormData) {
  await requireStaffProfile();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status)) throw new Error("Bad request.");
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("suppliers")
    .update({ listing_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
