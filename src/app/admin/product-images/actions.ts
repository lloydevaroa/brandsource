"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";

const BUCKET = "product-images";
// Staff uploads live under this prefix so removing one never touches imported supplier files.
const PREFIX = "uploads/";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

function refresh(slug: string) {
  revalidatePath(`/products/${slug}`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/product-images");
}

async function getImages(slug: string): Promise<string[]> {
  const { data, error } = await createServiceSupabase()
    .from("products")
    .select("example_image_urls")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(error.message);
  return data.example_image_urls ?? [];
}

async function setImages(slug: string, urls: string[]) {
  const { error } = await createServiceSupabase()
    .from("products")
    .update({ example_image_urls: urls })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
  refresh(slug);
}

/** Step 1 of an upload: a one-off signed URL so the browser sends the file straight to Storage. */
export async function createProductImageUpload(slug: string, filename: string) {
  await requireStaffProfile();
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `${PREFIX}${safeSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await createServiceSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}

/** Step 2: add the uploaded file to the end of the product's gallery. */
export async function addProductImage(slug: string, storagePath: string) {
  await requireStaffProfile();
  if (!storagePath.startsWith(PREFIX)) throw new Error("Bad path");
  const { data } = createServiceSupabase().storage.from(BUCKET).getPublicUrl(storagePath);
  const images = await getImages(slug);
  await setImages(slug, [...images, data.publicUrl]);
}

/** Move an image one place earlier or later. The first image is the main one. */
export async function moveProductImage(slug: string, url: string, dir: "up" | "down") {
  await requireStaffProfile();
  const images = await getImages(slug);
  const i = images.indexOf(url);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= images.length) return;
  [images[i], images[j]] = [images[j], images[i]];
  await setImages(slug, images);
}

export async function removeProductImage(slug: string, url: string) {
  await requireStaffProfile();
  const images = await getImages(slug);
  await setImages(slug, images.filter((u) => u !== url));
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at >= 0) {
    const path = decodeURIComponent(url.slice(at + marker.length));
    if (path.startsWith(PREFIX)) await createServiceSupabase().storage.from(BUCKET).remove([path]);
  }
}
