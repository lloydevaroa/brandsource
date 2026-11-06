import { NextResponse } from "next/server";
import { artworkDisplayName } from "@/lib/artwork";
import { renderProofReady } from "@/lib/emails/milestones";
import { orderReference } from "@/lib/emails/order-confirmation";
import { getResend } from "@/lib/resend";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Staff only: send an attached proof to the customer. This emails them (the "proof ready" email, with
 * the file attached when it is under 10MB) and releases the proof to their order page. The proof is
 * only marked as sent once the email has gone, so a failure can simply be retried.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string; proofId: string }> }) {
  const { orderId, proofId } = await params;
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: proof } = await supabase
    .from("proofs")
    .select("id, storage_path, status, sent_at, order_line_id, order_lines!inner(order_id, quantity, products(name))")
    .eq("id", proofId)
    .eq("order_lines.order_id", orderId)
    .maybeSingle();
  if (!proof) return NextResponse.json({ error: "Proof not found." }, { status: 404 });

  const { data: newest } = await supabase
    .from("proofs")
    .select("id")
    .eq("order_line_id", proof.order_line_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newest?.id !== proof.id) {
    return NextResponse.json({ error: "A newer proof has been attached for this item. Send that one." }, { status: 409 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, customer:profiles!orders_customer_id_fkey(full_name, email)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "draft") return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const customerRaw = order.customer as unknown as
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
  const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
  if (!customer?.email) {
    return NextResponse.json({ error: "This order has no customer email on file." }, { status: 400 });
  }

  const lineRaw = proof.order_lines as unknown as
    | { quantity: number; products: { name: string } | { name: string }[] | null }
    | { quantity: number; products: { name: string } | { name: string }[] | null }[];
  const line = Array.isArray(lineRaw) ? lineRaw[0] : lineRaw;
  const product = Array.isArray(line?.products) ? line.products[0] : line?.products;

  // Attach the file when it is small enough for email.
  let attachment: { filename: string; content: Buffer } | null = null;
  const download = await supabase.storage.from("artwork").download(proof.storage_path);
  if (download.data && download.data.size <= MAX_ATTACHMENT_BYTES) {
    attachment = { filename: artworkDisplayName(proof.storage_path), content: Buffer.from(await download.data.arrayBuffer()) };
  }

  const baseUrl = new URL(req.url).origin;
  const email = renderProofReady({
    customerName: customer.full_name ?? "",
    orderNumber: orderReference(order.id),
    itemLabels: [`${line?.quantity ?? 1} x ${product?.name ?? "Product"}`],
    orderUrl: `${baseUrl}/account/orders/${order.id}`,
    baseUrl,
    attached: attachment !== null,
  });

  try {
    const { error } = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "BRANDSource <onboarding@resend.dev>",
      to: customer.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(attachment ? { attachments: [attachment] } : {}),
    });
    if (error) return NextResponse.json({ error: `Email not sent: ${error.message}` }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: `Email not sent: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }

  const sentAt = new Date().toISOString();
  // First send releases the proof; a resend keeps the original time.
  if (!proof.sent_at) await supabase.from("proofs").update({ sent_at: sentAt }).eq("id", proof.id);

  return NextResponse.json({ sentTo: customer.email, sentAt: proof.sent_at ?? sentAt, attached: attachment !== null });
}
