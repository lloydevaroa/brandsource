"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { createInvoice, findOrCreateContact } from "@/lib/xero";

function describeLine(name: string, configuration: Record<string, string | string[]>) {
  const options = Object.entries(configuration)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");
  return options ? `${name} (${options})` : name;
}

/**
 * Pushes a completed purchase-order job to Xero as an invoice, then marks the
 * order 'invoiced' (a one-way flag — see recomputeOrderStatus in admin/actions.ts).
 * Returns errors rather than throwing: Next.js redacts thrown server-action
 * messages in production, and staff need to see what Xero actually said.
 */
export async function sendOrderToXero(
  orderId: string
): Promise<{ invoiceNumber: string } | { error: string }> {
  try {
    return await pushOrderToXero(orderId);
  } catch (err) {
    console.error("[xero] send failed", orderId, err);
    return { error: err instanceof Error ? err.message : "Couldn't send to Xero." };
  }
}

async function pushOrderToXero(orderId: string) {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, status, payment_method, po_number, xero_invoice_id,
      client:clients ( id, name, contact_email, credit_term_days, xero_contact_id ),
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
      credit_term_days: number | null;
      xero_contact_id: string | null;
    } | null;
    order_lines: {
      quantity: number;
      unit_price: number;
      configuration: Record<string, string | string[]>;
      product: { name: string } | null;
    }[];
  };

  if (order.xero_invoice_id) throw new Error("This order has already been sent to Xero.");
  if (order.payment_method !== "po" || !order.client) {
    throw new Error("Only purchase-order jobs for managed clients are invoiced through Xero.");
  }
  if (order.status !== "completed") throw new Error("Only completed jobs can be invoiced.");
  if (order.order_lines.length === 0) throw new Error("This order has no lines to invoice.");

  let contactId = order.client.xero_contact_id;
  if (!contactId) {
    contactId = await findOrCreateContact(order.client.name, order.client.contact_email);
    await supabase.from("clients").update({ xero_contact_id: contactId }).eq("id", order.client.id);
  }

  const due = new Date();
  due.setDate(due.getDate() + (order.client.credit_term_days ?? 30));

  const invoice = await createInvoice({
    contactId,
    reference: order.po_number,
    dueDate: due.toISOString().slice(0, 10),
    lines: order.order_lines.map((line) => ({
      description: describeLine(line.product?.name ?? "Item", line.configuration),
      quantity: line.quantity,
      unitAmount: Number(line.unit_price),
    })),
  });

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "invoiced",
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      invoiced_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (updateError) {
    // The invoice exists in Xero even though we couldn't record it — say so
    // plainly so nobody pushes a duplicate.
    throw new Error(
      `Invoice ${invoice.InvoiceNumber} was created in Xero but couldn't be recorded here: ${updateError.message}`
    );
  }

  revalidatePath("/admin/orders");
  return { invoiceNumber: invoice.InvoiceNumber };
}
