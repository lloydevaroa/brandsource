"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { applyTierDiscount, priceForItem } from "@/lib/pricing";
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
  /** Artwork already uploaded to storage (from the cart), attached to the new line. */
  artwork?: { path: string; filename: string }[];
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
    .select("id, client_type, rate_tier_id")
    .eq("id", input.clientId)
    .single();
  if (clientError || !client) throw new UserFacingError("That client could not be found. Refresh the page and pick the client again.");
  if (client.client_type !== "managed") {
    throw new UserFacingError("Only managed clients can order on a purchase order.");
  }

  // Tier is looked up here, never taken as a percentage from the browser.
  // Not specified (undefined) means the client's own tier; null means Retail (the RRP).
  const tier = await getRateTier(input.rateTierId === undefined ? client.rate_tier_id : input.rateTierId);
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

    if (line.artwork && line.artwork.length > 0) {
      const { error: artworkError } = await supabase.from("artwork_files").insert(
        line.artwork.map((a) => ({ order_line_id: orderLine.id, storage_path: a.path, uploaded_by: staffId }))
      );
      if (artworkError) throw new Error(artworkError.message);
    }
  }

  await notifyOrderReceived(order.id);

  revalidatePath("/admin");
  return { orderId: order.id as string };
}

async function attachArtwork(
  supabase: ReturnType<typeof createServiceSupabase>,
  orderLineId: string,
  artwork: { path: string; filename: string }[] | undefined,
  staffId: string
) {
  if (!artwork || artwork.length === 0) return;
  const { error } = await supabase
    .from("artwork_files")
    .insert(artwork.map((a) => ({ order_line_id: orderLineId, storage_path: a.path, uploaded_by: staffId })));
  if (error) throw new Error(error.message);
}

export type EditOrderLineInput = ManagedOrderLineInput & {
  /** Set for lines already on the order; they keep their saved price and their place on the board. */
  lineId?: string;
};

/**
 * Edits a PO order in place (staff, until it is invoiced). Existing lines keep
 * their sub-order (so status and assignee survive) and their saved RRP, which
 * is re-discounted if the tier changes. New lines are priced from the current
 * catalogue. A line already past "New order" can't be removed.
 */
export async function updateManagedOrder(input: {
  orderId: string;
  clientId: string;
  rateTierId?: string | null;
  poNumber: string;
  lines: EditOrderLineInput[];
  /** Saved artwork files (artwork_files ids) the account manager removed from kept lines. */
  removedArtworkIds?: string[];
}): Promise<{ orderId: string } | { error: string }> {
  let staffId: string | null = null;
  try {
    const staff = await requireStaffProfile();
    staffId = staff.id;
    return await applyOrderEdit(input, staff.id);
  } catch (err) {
    return { error: await reportError({ area: "orders", action: "Couldn't save the order changes", error: err, staffId }) };
  }
}

async function applyOrderEdit(
  input: {
    orderId: string;
    clientId: string;
    rateTierId?: string | null;
    poNumber: string;
    lines: EditOrderLineInput[];
    removedArtworkIds?: string[];
  },
  staffId: string
) {
  if (!input.clientId) throw new UserFacingError("No client was chosen. Pick a client and try again.");
  if (input.lines.length === 0) throw new UserFacingError("An order needs at least one item. Add one, or leave the order as it is.");

  const supabase = createServiceSupabase();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_method, status")
    .eq("id", input.orderId)
    .single();
  if (orderError || !order) throw new UserFacingError("That order could not be found.");
  if (order.payment_method !== "po") throw new UserFacingError("Only purchase-order orders can be edited here.");
  if (order.status === "invoiced") {
    throw new UserFacingError("This order has already been sent to Xero as an invoice, so it can't be edited here.");
  }

  const { data: client } = await supabase.from("clients").select("id, client_type").eq("id", input.clientId).single();
  if (!client || client.client_type !== "managed") throw new UserFacingError("That client could not be found. Refresh the page and pick the client again.");

  const { data: existing, error: existingError } = await supabase
    .from("order_lines")
    .select("id, quantity, unit_price, list_price, sub_orders ( id, status )")
    .eq("order_id", input.orderId);
  if (existingError) throw new Error(existingError.message);
  type ExistingLine = { id: string; quantity: number; unit_price: number | string; list_price: number | string | null; sub_orders: { id: string; status: string }[] };
  const existingById = new Map((existing as unknown as ExistingLine[]).map((l) => [l.id, l]));

  const keptIds = new Set(input.lines.flatMap((l) => (l.lineId ? [l.lineId] : [])));
  for (const id of keptIds) {
    if (!existingById.has(id)) throw new UserFacingError("An item on this order no longer exists. Reload the page and try again.");
  }
  const removed = [...existingById.values()].filter((l) => !keptIds.has(l.id));
  for (const l of removed) {
    if (l.sub_orders.some((s) => s.status !== "new_order")) {
      throw new UserFacingError("An item you removed is already past \"New order\" on the board. Move it back to New order first, or keep it on the order.");
    }
  }

  const tier = await getRateTier(input.rateTierId);
  const discount = tier?.discount_percent ?? 0;
  const catalog = await getCatalog();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", input.lines.map((l) => l.productSlug));
  if (productsError) throw new Error(productsError.message);
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id as string]));

  const priced = input.lines.map((line) => {
    const prior = line.lineId ? existingById.get(line.lineId) : undefined;
    // Saved RRP for existing lines (a retail line saved before tiers has no list_price: its unit_price was the RRP).
    const listPrice = prior ? Number(prior.list_price ?? prior.unit_price) : priceForItem(catalog, line.productSlug, line.configuration);
    if (!prior) {
      const productId = productIdBySlug.get(line.productSlug);
      if (!productId) throw new UserFacingError(`The product "${line.productSlug}" is no longer in the catalogue. Remove it from the order.`);
      if (listPrice === null || listPrice <= 0) {
        const name = catalog.find((p) => p.slug === line.productSlug)?.name ?? line.productSlug;
        throw new UserFacingError(`"${name}" has no price set in the catalogue, so it can't be added to an order or invoiced. Remove it, or ask Lloyd to set its price.`);
      }
    }
    return { ...line, productId: productIdBySlug.get(line.productSlug) ?? null, listPrice: listPrice as number, unitPrice: applyTierDiscount(listPrice as number, discount) };
  });
  if (priced.some((l) => l.quantity < 1 || !Number.isFinite(l.quantity))) throw new UserFacingError("Quantities must be at least 1.");

  for (const line of priced) {
    if (line.lineId) {
      const { error } = await supabase
        .from("order_lines")
        .update({ quantity: line.quantity, unit_price: line.unitPrice, list_price: line.listPrice })
        .eq("id", line.lineId);
      if (error) throw new Error(error.message);
      await attachArtwork(supabase, line.lineId, line.artwork, staffId);
    } else {
      const { data: orderLine, error } = await supabase
        .from("order_lines")
        .insert({
          order_id: input.orderId,
          product_id: line.productId,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          list_price: line.listPrice,
          configuration: line.configuration,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { error: subError } = await supabase
        .from("sub_orders")
        .insert({ order_id: input.orderId, order_line_id: orderLine.id, status: "new_order" });
      if (subError) throw new Error(subError.message);
      await attachArtwork(supabase, orderLine.id as string, line.artwork, staffId);
    }
  }

  // Artwork removed from lines that stay on the order (only ever this order's own files).
  if (input.removedArtworkIds && input.removedArtworkIds.length > 0) {
    const { error } = await supabase
      .from("artwork_files")
      .delete()
      .in("id", input.removedArtworkIds)
      .in("order_line_id", [...existingById.keys()]);
    if (error) throw new Error(error.message);
  }

  for (const l of removed) {
    const { error: subError } = await supabase.from("sub_orders").delete().eq("order_line_id", l.id);
    if (subError) throw new Error(subError.message);
    const { error } = await supabase.from("order_lines").delete().eq("id", l.id);
    if (error) throw new Error(error.message);
  }

  // Order-level status from its sub-orders (no emails: the order was already notified when created).
  const { data: subs } = await supabase.from("sub_orders").select("status").eq("order_id", input.orderId);
  const statuses = (subs ?? []).map((s) => s.status as string);
  const nextStatus = statuses.length && statuses.every((s) => s === "completed")
    ? "completed"
    : statuses.some((s) => ["sent_to_supplier", "in_production", "dispatched"].includes(s))
      ? "in_production"
      : "new_order";

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      client_id: input.clientId,
      po_number: input.poNumber.trim() || null,
      rate_tier_id: tier?.id ?? null,
      total_amount: priced.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      status: nextStatus,
    })
    .eq("id", input.orderId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/new");
  return { orderId: input.orderId };
}
