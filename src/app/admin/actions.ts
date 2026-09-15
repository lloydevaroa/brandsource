"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import type { SubOrderStatus } from "@/lib/types";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

export async function updateSubOrderStatus(subOrderId: string, status: SubOrderStatus) {
  await requireStaffProfile();
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("sub_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subOrderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function claimSubOrder(subOrderId: string, claimedBy: string | null) {
  await requireStaffProfile();
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("sub_orders")
    .update({ claimed_by: claimedBy, updated_at: new Date().toISOString() })
    .eq("id", subOrderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
