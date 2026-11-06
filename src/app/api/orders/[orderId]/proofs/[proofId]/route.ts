import { NextResponse } from "next/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";
import { COLUMN_STATUS, boardColumn, effectiveChecklist } from "@/app/admin/status";

export const runtime = "nodejs";

/** The customer who placed the order approves the proof, or asks for changes. */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string; proofId: string }> }) {
  const { orderId, proofId } = await params;
  const profile = await syncCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to review your proof." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: string; note?: string } | null;
  const action = body?.action;
  const note = (body?.note ?? "").trim();
  if (action !== "approve" && action !== "request_changes") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (action === "request_changes" && (note.length === 0 || note.length > 1000)) {
    return NextResponse.json({ error: "Tell us what you'd like changed (up to 1000 characters)." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data: order } = await supabase.from("orders").select("id, customer_id, status").eq("id", orderId).maybeSingle();
  if (!order || order.status === "draft" || order.customer_id !== profile.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: proof } = await supabase
    .from("proofs")
    .select("id, status, sent_at, order_line_id, order_lines!inner(order_id)")
    .eq("id", proofId)
    .eq("order_lines.order_id", orderId)
    .maybeSingle();
  if (!proof || !proof.sent_at) return NextResponse.json({ error: "Proof not found." }, { status: 404 });

  // Only the newest proof for an item can be answered.
  const { data: newest } = await supabase
    .from("proofs")
    .select("id")
    .eq("order_line_id", proof.order_line_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newest?.id !== proof.id || proof.status !== "awaiting_approval") {
    return NextResponse.json({ error: "This proof has already been answered or replaced. Refresh the page." }, { status: 409 });
  }

  const approved = action === "approve";
  const { error } = await supabase
    .from("proofs")
    .update({ status: approved ? "approved" : "changes_requested", customer_note: approved ? null : note })
    .eq("id", proof.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (approved) {
    const { data: sub } = await supabase
      .from("sub_orders")
      .select("id, status, checklist")
      .eq("order_line_id", proof.order_line_id)
      .maybeSingle();
    if (sub) {
      await supabase
        .from("sub_orders")
        .update({
          checklist: { ...effectiveChecklist(sub.status, sub.checklist), proof_approved: true },
          ...(boardColumn(sub.status) === "new_order" ? { status: COLUMN_STATUS.processing } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }
  }

  return NextResponse.json({ ok: true, status: approved ? "approved" : "changes_requested" });
}
