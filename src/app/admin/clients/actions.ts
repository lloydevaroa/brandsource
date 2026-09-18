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
  accountManagerId: string;
  creditTermDays: number;
  contactEmail: string;
}) {
  await requireStaffProfile();

  const name = input.name.trim();
  if (!name) throw new Error("Client name is required.");
  if (!input.accountManagerId) throw new Error("Choose an account manager.");
  if (![7, 14, 30].includes(input.creditTermDays)) {
    throw new Error("Credit terms must be 7, 14, or 30 days.");
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("clients").insert({
    name,
    client_type: "managed",
    account_manager_id: input.accountManagerId,
    credit_term_days: input.creditTermDays,
    contact_email: input.contactEmail.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  revalidatePath("/admin/orders/new");
}
