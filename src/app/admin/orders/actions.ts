"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createInvoice, findOrCreateContact } from "@/lib/xero";
import { reportError, UserFacingError } from "@/lib/error-log";

function describeLine(name: string, configuration: Record<string, string | string[]>) {
  const options = Object.entries(configuration)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");
  return options ? `${name} (${options})` : name;
}

/**
 * Pushes a purchase-order order to Xero as an invoice at any stage after it is
 * placed, so payment can start while it is being made. Invoicing is recorded by
 * xero_invoice_id/number, not by order status, so production status keeps
 * moving as sub-orders progress.
 * Returns errors rather than throwing: Next.js redacts thrown server-action
 * messages in production, and staff need to see what Xero actually said.
 */
export async function sendOrderToXero(
  orderId: string
): Promise<{ invoiceNumber: string } | { error: string }> {
  try {
    return await pushOrderToXero(orderId);
  } catch (err) {
    return { error: await reportError({ area: "xero", action: "Couldn't send the order to Xero", error: err }) };
  }
}

async function pushOrderToXero(orderId: string) {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new UserFacingError("You are not signed in as a manager or admin, so you cannot send orders to Xero.");
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, status, payment_method, po_number, xero_invoice_id,
      client:clients ( id, name, contact_email, xero_contact_id ),
      order_lines ( quantity, unit_price, configuration, product:products ( name ) )
    `
    )
    .eq("id", orderId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Order not found.");

  // Same to-one embed cardinality caveat as admin/page.tsx.
  const order = data as unknown as {
    id: string;
    status: string;
    payment_method: string;
    po_number: string | null;
    xero_invoice_id: string | null;
    client: {
      id: string;
      name: string;
      contact_email: string | null;
      xero_contact_id: string | null;
    } | null;
    order_lines: {
      quantity: number;
      unit_price: number;
      configuration: Record<string, string | string[]>;
      product: { name: string } | null;
    }[];
  };

  if (order.xero_invoice_id) throw new UserFacingError("This order has already been sent to Xero. Check Xero before sending again, to avoid a duplicate invoice.");
  if (order.payment_method !== "po" || !order.client) {
    throw new UserFacingError("Only purchase-order orders for managed clients are invoiced through Xero.");
  }
  if (order.status === "draft") throw new UserFacingError("This order is still a draft, so it can't be sent to Xero yet.");
  if (order.order_lines.length === 0) throw new UserFacingError("This order has no lines to invoice.");

  let contactId = order.client.xero_contact_id;
  if (!contactId) {
    contactId = await findOrCreateContact(order.client.name, order.client.contact_email);
    await supabase.from("clients").update({ xero_contact_id: contactId }).eq("id", order.client.id);
  }

  const invoice = await createInvoice({
    contactId,
    reference: order.po_number,
    lines: order.order_lines.map((line) => ({
      description: describeLine(line.product?.name ?? "Item", line.configuration),
      quantity: line.quantity,
      unitAmount: Number(line.unit_price),
    })),
  });

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      invoiced_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (updateError) {
    // The invoice exists in Xero even though we couldn't record it — say so
    // plainly so nobody pushes a duplicate.
    throw new UserFacingError(
      `Invoice ${invoice.InvoiceNumber} WAS created in Xero but couldn't be recorded in BrandSource. Do not send this order again, or it will be duplicated.`
    );
  }

  revalidatePath("/admin/orders");
  return { invoiceNumber: invoice.InvoiceNumber };
}
