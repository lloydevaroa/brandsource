"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { priceForItem } from "@/lib/pricing";
import { getCatalog } from "@/lib/catalog";
import { notifyOrderReceived } from "@/lib/notifications";
import { reportError, UserFacingError } from "@/lib/error-log";
import { getRateTier, isMissingTierSchema } from "@/lib/rate-tiers";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new UserFacingError("You are not signed in as a staff member, so you cannot create orders.");
  }
  return profile;
}

export type ManagedOrderLineInput = {
  productSlug: string;
  configuration: Record<string, string | string[]>;
  quantity: number;
};

/**
 * Returns errors rather than throwing: Next.js redacts thrown server-action
 * messages in production, and staff need a message they can forward.
 */
export async function createManagedOrder(input: {
  clientId: string;
  rateTierId?: string | null;
  poNumber: string;
  lines: ManagedOrderLineInput[];
}): Promise<{ orderId: string } | { error: string }> {
  let staffId: string | null = null;
  try {
    const staff = await requireStaffProfile();
    staffId = staff.id;
    return await insertManagedOrder(input, staff.id);
  } catch (err) {
    return { error: await reportError({ area: "orders", action: "Couldn't create the order", error: err, staffId }) };
  }
}

async function insertManagedOrder(
  input: { clientId: string; rateTierId?: string | null; poNumber: string; lines: ManagedOrderLineInput[] },
  staffId: string
) {

  if (!input.clientId) throw new UserFacingError("No client was chosen. Pick a client and try again.");
  if (input.lines.length === 0) throw new UserFacingError("The order has no product lines. Add at least one and try again.");

  const supabase = createServiceSupabase();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, client_type")
    .eq("id", input.clientId)
    .single();
  if (clientError || !client) throw new UserFacingError("That client could not be found. Refresh the page and pick the client again.");
  if (client.client_type !== "managed") {
    throw new UserFacingError("Only managed clients can order on a purchase order.");
  }

  // Tier is looked up here, never taken as a percentage from the browser.
  // Unset means Retail (the RRP).
  const tier = await getRateTier(input.rateTierId);
  const discount = tier?.discount_percent ?? 0;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug")
    .in(
      "slug",
      input.lines.map((l) => l.productSlug)
    );
  if (productsError) throw new Error(productsError.message);
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id as string]));

  const catalog = await getCatalog();
  const pricedLines = input.lines.map((line) => {
    const productId = productIdBySlug.get(line.productSlug);
    if (!productId) throw new UserFacingError(`The product "${line.productSlug}" is no longer in the catalogue. Remove it from the order.`);
    const unitPrice = priceForItem(catalog, line.productSlug, line.configuration, discount);
    const listPrice = priceForItem(catalog, line.productSlug, line.configuration);
    if (unitPrice === null || unitPrice <= 0) {
      const name = catalog.find((p) => p.slug === line.productSlug)?.name ?? line.productSlug;
      throw new UserFacingError(
        `"${name}" has no price set in the catalogue, so it can't be added to an order or invoiced. Remove it from the order, or ask Lloyd to set its price.`
      );
    }
    return { ...line, productId, unitPrice, listPrice };
  });

  const totalAmount = pricedLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const orderRow: Record<string, unknown> = {
    client_id: input.clientId,
    created_by_id: staffId,
    payment_method: "po",
    po_number: input.poNumber.trim() || null,
    status: "new_order",
    total_amount: totalAmount,
  };
  let { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(tier ? { ...orderRow, rate_tier_id: tier.id } : orderRow)
    .select("id")
    .single();
  if (orderError && isMissingTierSchema(orderError.message) && !tier) {
    ({ data: order, error: orderError } = await supabase.from("orders").insert(orderRow).select("id").single());
  }
  if (orderError || !order) throw new Error(orderError?.message ?? "Order was not created");

  for (const line of pricedLines) {
    const { data: orderLine, error: lineError } = await supabase
      .from("order_lines")
      .insert({
        order_id: order.id,
        product_id: line.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        ...(tier ? { list_price: line.listPrice } : {}),
        configuration: line.configuration,
      })
      .select("id")
      .single();
    if (lineError) throw new Error(lineError.message);

    const { error: subOrderError } = await supabase.from("sub_orders").insert({
      order_id: order.id,
      order_line_id: orderLine.id,
      status: "new_order",
    });
    if (subOrderError) throw new Error(subOrderError.message);
  }

  await notifyOrderReceived(order.id);

  revalidatePath("/admin");
  return { orderId: order.id as string };
}
