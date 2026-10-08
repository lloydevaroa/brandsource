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

export async function createManagedClient(input: {
  name: string;
  accountManagerId?: string;
  contactEmail: string;
}) {
  await requireStaffProfile();

  const name = input.name.trim();
  if (!name) throw new Error("Client name is required.");

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("clients").insert({
    name,
    client_type: "managed",
    account_manager_id: input.accountManagerId || null,
    contact_email: input.contactEmail.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  revalidatePath("/admin/orders/new");
}

/** Sets a client's rate tier. Empty tierId clears it, which means Retail (RRP). */
export async function setClientRateTier(clientId: string, tierId: string) {
  await requireStaffProfile();
  const { error } = await createServiceSupabase()
    .from("clients")
    .update({ rate_tier_id: tierId || null })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/orders/new");
}

/**
 * Links a customer's login to a client, so the client's rate tier applies when
 * they sign in. The customer must have signed in once (that creates the profile).
 */
export async function linkLoginToClient(input: { email: string; clientId: string }) {
  await requireStaffProfile();
  const email = input.email.trim().toLowerCase();
  if (!email || !input.clientId) throw new Error("Enter the customer's email and choose a client.");

  const supabase = createServiceSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) {
    throw new Error(`No login found for ${email}. They need to sign in to BrandSource once first, then try again.`);
  }
  const { error: updateError } = await supabase.from("profiles").update({ client_id: input.clientId }).eq("id", profile.id);
  if (updateError) throw new Error(updateError.message);
  revalidatePath("/admin/clients");
}
