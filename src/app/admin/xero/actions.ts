"use server";

import { revalidatePath } from "next/cache";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { disconnectXero } from "@/lib/xero";

export async function disconnect() {
  const profile = await syncCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Only an admin can disconnect Xero.");
  await disconnectXero();
  revalidatePath("/admin/xero");
}
