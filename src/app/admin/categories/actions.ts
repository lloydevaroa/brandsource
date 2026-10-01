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

/** Replace a product's category assignments with exactly the ticked boxes. */
export async function saveProductCategories(formData: FormData) {
  await requireStaffProfile();

  const productId = String(formData.get("productId") ?? "");
  if (!productId) throw new Error("Missing product.");
  const categoryIds = formData.getAll("category").map(String);

  const supabase = createServiceSupabase();
  const { error: delErr } = await supabase.from("product_categories").delete().eq("product_id", productId);
  if (delErr) throw new Error(delErr.message);

  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from("product_categories")
      .insert(categoryIds.map((category_id) => ({ product_id: productId, category_id })));
    if (error) throw new Error(error.message);
  }

  // Home, category and product pages are all cached for 60s; refresh them now.
  revalidatePath("/", "layout");
}
