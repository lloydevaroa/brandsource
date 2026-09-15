import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id in session metadata" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  const { data: order, error: orderFetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (orderFetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Idempotent: Stripe retries webhooks, so skip if already processed.
  if (order.status === "paid") {
    return NextResponse.json({ received: true, alreadyProcessed: true });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      total_amount: (session.amount_total ?? 0) / 100,
    })
    .eq("id", orderId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: lines, error: linesError } = await supabase
    .from("order_lines")
    .select("id")
    .eq("order_id", orderId);
  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 });
  }

  if (lines && lines.length > 0) {
    const { error: subOrderError } = await supabase.from("sub_orders").insert(
      lines.map((line) => ({
        order_id: orderId,
        order_line_id: line.id,
        status: "payment_received",
      }))
    );
    if (subOrderError) {
      return NextResponse.json({ error: subOrderError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
