import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { renderArtworkReminder } from "@/lib/emails/artwork-reminder";
import { orderReference } from "@/lib/emails/order-confirmation";
import { configurationSummary } from "@/lib/pricing";
import { getResend } from "@/lib/resend";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Product = { name: string; slug: string };
type Line = {
  quantity: number;
  configuration: Record<string, string | string[]> | null;
  products: Product | Product[] | null;
  artwork_files: { id: string }[] | null;
};

/** Staff only: email the customer who placed the order a reminder for every product still missing artwork. */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, customer:profiles!orders_customer_id_fkey(full_name, email), order_lines(quantity, configuration, products(name, slug), artwork_files(id))"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "draft") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const customerRaw = order.customer as unknown as
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
  const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
  if (!customer?.email) {
    return NextResponse.json({ error: "This order has no customer email on file." }, { status: 400 });
  }

  const catalog = await getCatalog();
  const missing = ((order.order_lines ?? []) as unknown as Line[])
    .filter((l) => (l.artwork_files ?? []).length === 0)
    .map((l) => {
      const product = Array.isArray(l.products) ? l.products[0] : l.products;
      return {
        name: product?.name ?? "Product",
        summary: product ? configurationSummary(catalog, product.slug, l.configuration ?? {}) : "",
        quantity: l.quantity,
      };
    });
  if (missing.length === 0) {
    return NextResponse.json({ error: "Every item on this order already has artwork." }, { status: 409 });
  }

  // Links and the logo point at the site the staff member is on, so this works on staging as well as live.
  const baseUrl = new URL(req.url).origin;
  const email = renderArtworkReminder({
    customerName: customer.full_name ?? "",
    orderNumber: orderReference(order.id),
    items: missing,
    orderUrl: `${baseUrl}/account/orders/${order.id}`,
    baseUrl,
  });

  try {
    const { error } = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "BRANDSource <onboarding@resend.dev>",
      to: customer.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) return NextResponse.json({ error: `Email not sent: ${error.message}` }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: `Email not sent: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ sentTo: customer.email, items: missing.length });
}

