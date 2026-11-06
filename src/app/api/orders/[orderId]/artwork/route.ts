import { NextResponse } from "next/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { safeArtworkFilename, validateArtworkFile } from "@/lib/artwork";

export const runtime = "nodejs";

/** The signed-in customer who placed the order, or staff. Returns the profile id on success. */
async function authorise(orderId: string) {
  const profile = await syncCurrentProfile();
  if (!profile) return { error: "Sign in to upload artwork.", status: 401 as const };
  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const isStaff = profile.role === "admin" || profile.role === "manager";
  if (!order || order.status === "draft" || (!isStaff && order.customer_id !== profile.id)) {
    return { error: "Order not found.", status: 404 as const };
  }
  return { profile, supabase };
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const access = await authorise(orderId);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { profile, supabase } = access;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const lineId = form.get("lineId");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (typeof lineId !== "string" || !lineId) return NextResponse.json({ error: "Missing lineId" }, { status: 400 });

  const filename = safeArtworkFilename(file.name || "artwork");
  const invalid = validateArtworkFile(file, filename);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });

  // The line must belong to this order.
  const { data: line } = await supabase
    .from("order_lines")
    .select("id")
    .eq("id", lineId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!line) return NextResponse.json({ error: "That item isn't on this order." }, { status: 404 });

  const storagePath = `orders/${orderId}/${line.id}/${Date.now()}-${filename}`;
  const { error: uploadError } = await supabase.storage
    .from("artwork")
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: row, error: insertError } = await supabase
    .from("artwork_files")
    .insert({ order_line_id: line.id, storage_path: storagePath, uploaded_by: profile.id })
    .select("id")
    .single();
  if (insertError || !row) {
    await supabase.storage.from("artwork").remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Could not save the file." }, { status: 500 });
  }

  return NextResponse.json({ id: row.id, filename });
}

/** Remove a file the customer uploaded by mistake, until a proof exists for that item. */
export async function DELETE(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const access = await authorise(orderId);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { supabase } = access;

  const body = (await req.json().catch(() => null)) as { fileId?: string } | null;
  if (!body?.fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const { data: file } = await supabase
    .from("artwork_files")
    .select("id, storage_path, order_line_id, order_lines!inner(order_id)")
    .eq("id", body.fileId)
    .eq("order_lines.order_id", orderId)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { count } = await supabase
    .from("proofs")
    .select("id", { count: "exact", head: true })
    .eq("order_line_id", file.order_line_id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "A proof has already been made for this item. Contact us to change the artwork." },
      { status: 409 }
    );
  }

  await supabase.from("artwork_files").delete().eq("id", file.id);
  await supabase.storage.from("artwork").remove([file.storage_path]);
  return NextResponse.json({ ok: true });
}
