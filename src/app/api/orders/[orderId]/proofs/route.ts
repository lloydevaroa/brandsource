import { NextResponse } from "next/server";
import { safeArtworkFilename, validateArtworkFile } from "@/lib/artwork";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { COLUMN_STATUS, boardColumn, effectiveChecklist } from "@/app/admin/status";

export const runtime = "nodejs";

/**
 * Staff only: attach a proof to one item of an order. Attaching only stores it. The customer does not
 * see it, and is not emailed, until staff press Send to customer (see ./[proofId]/send).
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

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

  const filename = safeArtworkFilename(file.name || "proof");
  const invalid = validateArtworkFile(file, filename);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });

  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, order_lines(id)"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "draft") return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const line = ((order.order_lines ?? []) as unknown as { id: string }[]).find((l) => l.id === lineId);
  if (!line) return NextResponse.json({ error: "That item isn't on this order." }, { status: 404 });

  const bytes = await file.arrayBuffer();
  const storagePath = `proofs/${orderId}/${line.id}/${Date.now()}-${filename}`;
  const { error: uploadError } = await supabase.storage.from("artwork").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: proof, error: insertError } = await supabase
    .from("proofs")
    .insert({ order_line_id: line.id, storage_path: storagePath, status: "awaiting_approval" })
    .select("id")
    .single();
  if (insertError || !proof) {
    await supabase.storage.from("artwork").remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Could not save the proof." }, { status: 500 });
  }

  // Making a proof means the artwork has been checked: tick "Artwork received", and move a New order card to Processing.
  const { data: sub } = await supabase
    .from("sub_orders")
    .select("id, status, checklist")
    .eq("order_line_id", line.id)
    .maybeSingle();
  if (sub) {
    const checklist = { ...effectiveChecklist(sub.status, sub.checklist), artwork_received: true, proof_approved: false };
    await supabase
      .from("sub_orders")
      .update({
        checklist,
        ...(boardColumn(sub.status) === "new_order" ? { status: COLUMN_STATUS.processing } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  }

  return NextResponse.json({ id: proof.id });
}
