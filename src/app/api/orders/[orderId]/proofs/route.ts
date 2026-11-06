import { NextResponse } from "next/server";
import { artworkDisplayName, safeArtworkFilename, validateArtworkFile } from "@/lib/artwork";
import { renderProofReady } from "@/lib/emails/milestones";
import { orderReference } from "@/lib/emails/order-confirmation";
import { getResend } from "@/lib/resend";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { COLUMN_STATUS, boardColumn, effectiveChecklist } from "@/app/admin/status";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Staff only: attach a proof to one item of an order. It shows on the customer's order page for
 * them to approve, and (optionally) a "proof ready" email goes to them with the file attached.
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
  const notify = form.get("notify") === "1";
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (typeof lineId !== "string" || !lineId) return NextResponse.json({ error: "Missing lineId" }, { status: 400 });

  const filename = safeArtworkFilename(file.name || "proof");
  const invalid = validateArtworkFile(file, filename);
  if (invalid) return NextResponse.json({ error: invalid.error }, { status: invalid.status });

  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, customer:profiles!orders_customer_id_fkey(full_name, email), order_lines(id, quantity, products(name))"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "draft") return NextResponse.json({ error: "Order not found." }, { status: 404 });

  type LineRow = { id: string; quantity: number; products: { name: string } | { name: string }[] | null };
  const line = ((order.order_lines ?? []) as unknown as LineRow[]).find((l) => l.id === lineId);
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

  let emailed = false;
  let emailError: string | null = null;
  if (notify) {
    const customerRaw = order.customer as unknown as
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
    const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
    if (!customer?.email) {
      emailError = "This order has no customer email on file.";
    } else {
      const baseUrl = new URL(req.url).origin;
      const product = Array.isArray(line.products) ? line.products[0] : line.products;
      const attach = file.size <= MAX_ATTACHMENT_BYTES;
      const email = renderProofReady({
        customerName: customer.full_name ?? "",
        orderNumber: orderReference(order.id),
        itemLabels: [`${line.quantity} x ${product?.name ?? "Product"}`],
        orderUrl: `${baseUrl}/account/orders/${order.id}`,
        baseUrl,
        attached: attach,
      });
      try {
        const { error } = await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "BRANDSource <onboarding@resend.dev>",
          to: customer.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(attach ? { attachments: [{ filename: artworkDisplayName(storagePath), content: Buffer.from(bytes) }] } : {}),
        });
        if (error) emailError = error.message;
        else emailed = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : "unknown error";
      }
    }
  }

  return NextResponse.json({ id: proof.id, emailed, emailError });
}
