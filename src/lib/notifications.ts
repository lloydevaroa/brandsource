import { getResend } from "./resend";
import { createServiceSupabase } from "./supabase/server";

/**
 * Managed-client notification milestones (build-brief.md item 4), scoped to
 * managed (PO) clients only for now — direct-consumer notifications are a
 * separate, later slice. Best-effort: a missing/broken Resend key must never
 * block the order flow that triggered the notification.
 */

type OrderContext = {
  poNumber: string | null;
  clientName: string;
  clientEmail: string | null;
  accountManagerEmail: string | null;
};

async function getOrderContext(orderId: string): Promise<OrderContext | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("orders")
    .select(
      `
      po_number,
      client:clients (
        name,
        contact_email,
        account_manager:profiles!clients_account_manager_id_fkey ( email )
      )
    `
    )
    .eq("id", orderId)
    .single();

  // Same to-one embed cardinality caveat as admin/page.tsx.
  const row = data as unknown as {
    po_number: string | null;
    client: { name: string; contact_email: string | null; account_manager: { email: string | null } | null } | null;
  } | null;
  if (!row?.client) return null;

  return {
    poNumber: row.po_number,
    clientName: row.client.name,
    clientEmail: row.client.contact_email,
    accountManagerEmail: row.client.account_manager?.email ?? null,
  };
}

async function sendEmail(to: string | null, subject: string, text: string) {
  if (!to) return;
  try {
    const resend = getResend();
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "BRANDSource <onboarding@resend.dev>",
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error(`Notification email to ${to} ("${subject}") failed:`, err);
  }
}

function reference(poNumber: string | null) {
  return poNumber ? ` (PO ${poNumber})` : "";
}

export async function notifyOrderReceived(orderId: string) {
  const ctx = await getOrderContext(orderId);
  if (!ctx) return;
  const ref = reference(ctx.poNumber);
  await sendEmail(
    ctx.clientEmail,
    "Your BRANDSource order has been received",
    `Hi ${ctx.clientName},\n\nWe've received your order${ref}. We'll be in touch once it's in production, once manufacturing is finished, and again once delivery is complete.\n\n— BRANDSource`
  );
  await sendEmail(
    ctx.accountManagerEmail,
    "New order created",
    `${ctx.clientName} has a new order on file${ref}. Track its progress on the staff dashboard.`
  );
}

export async function notifyManufacturingBegun(orderId: string) {
  const ctx = await getOrderContext(orderId);
  if (!ctx) return;
  await sendEmail(
    ctx.clientEmail,
    "Your BRANDSource order is in production",
    `Hi ${ctx.clientName},\n\nManufacturing has begun on your order${reference(ctx.poNumber)}.\n\n— BRANDSource`
  );
}

export async function notifyManufacturingFinished(orderId: string) {
  const ctx = await getOrderContext(orderId);
  if (!ctx) return;
  await sendEmail(
    ctx.clientEmail,
    "Your BRANDSource order has finished manufacturing",
    `Hi ${ctx.clientName},\n\nManufacturing is complete on your order${reference(ctx.poNumber)} and it's on its way to you.\n\n— BRANDSource`
  );
}

export async function notifyDeliveryCompleted(orderId: string) {
  const ctx = await getOrderContext(orderId);
  if (!ctx) return;
  await sendEmail(
    ctx.clientEmail,
    "Your BRANDSource order has been delivered",
    `Hi ${ctx.clientName},\n\nYour order${reference(ctx.poNumber)} has been delivered. Thanks for your business.\n\n— BRANDSource`
  );
}
