"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";

const BUCKET = "hero-images";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

function refresh() {
  // Home and category pages are cached for 60s; refresh them now.
  revalidatePath("/", "layout");
}

/** Step 1 of an upload: a one-off signed URL so the browser sends the file straight to Storage. */
export async function createHeroUpload(pageKey: string, filename: string) {
  await requireStaffProfile();
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const safeKey = pageKey.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `${safeKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await createServiceSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}

/** Step 2: record the uploaded file as the last slide on the page. */
export async function addHeroSlide(pageKey: string, storagePath: string) {
  await requireStaffProfile();
  const supabase = createServiceSupabase();
  const { data: last } = await supabase
    .from("hero_slides")
    .select("sort_order")
    .eq("page_key", pageKey)
    .order("sort_order", { ascending: false })
    .limit(1);
  const next = (last?.[0]?.sort_order ?? 0) + 10;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const { error } = await supabase.from("hero_slides").insert({
    page_key: pageKey,
    image_url: pub.publicUrl,
    storage_path: storagePath,
    sort_order: next,
  });
  if (error) throw new Error(error.message);
  refresh();
  revalidatePath("/admin/hero");
}

export async function saveHeroSlide(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireStaffProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing slide." };
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const href = text("button_href");
  if (href && !/^(\/|https?:\/\/)/.test(href)) {
    return { ok: false, error: "Button link must start with / or https://" };
  }
  const { error } = await createServiceSupabase()
    .from("hero_slides")
    .update({
      headline: text("headline"),
      button_label: text("button_label"),
      button_href: href,
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  revalidatePath("/admin/hero");
  return { ok: true };
}

/** Swap a slide's position with its neighbour. */
export async function moveHeroSlide(formData: FormData) {
  await requireStaffProfile();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const supabase = createServiceSupabase();
  const { data: me } = await supabase.from("hero_slides").select("id, page_key").eq("id", id).single();
  if (!me) return;
  const { data: all } = await supabase
    .from("hero_slides")
    .select("id")
    .eq("page_key", me.page_key)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const ids = (all ?? []).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let n = 0; n < ids.length; n++) {
    const { error } = await supabase
      .from("hero_slides")
      .update({ sort_order: (n + 1) * 10 })
      .eq("id", ids[n]);
    if (error) throw new Error(error.message);
  }
  refresh();
  revalidatePath("/admin/hero");
}

export async function deleteHeroSlide(formData: FormData) {
  await requireStaffProfile();
  const id = String(formData.get("id") ?? "");
  const supabase = createServiceSupabase();
  const { data: row } = await supabase.from("hero_slides").select("storage_path").eq("id", id).single();
  const { error } = await supabase.from("hero_slides").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
  refresh();
  revalidatePath("/admin/hero");
}
