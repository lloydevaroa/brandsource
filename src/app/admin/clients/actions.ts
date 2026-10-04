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
