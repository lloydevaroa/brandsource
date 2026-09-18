"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { priceForItem } from "@/lib/pricing";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

export type ManagedOrderLineInput = {
  productSlug: string;
  configuration: Record<string, string | string[]>;
  quantity: number;
};

export async function createManagedOrder(input: {
  clientId: string;
  poNumber: string;
  lines: ManagedOrderLineInput[];
}) {
  const staff = await requireStaffProfile();

  if (!input.clientId) throw new Error("Choose a client.");
  if (input.lines.length === 0) throw new Error("Add at least one product line.");

  const supabase = createServiceSupabase();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, client_type")
    .eq("id", input.clientId)
    .single();
  if (clientError || !client) throw new Error("Client not found.");
  if (client.client_type !== "managed") {
    throw new Error("Only managed clients can order on a purchase order.");
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug")
    .in(
      "slug",
      input.lines.map((l) => l.productSlug)
    );
  if (productsError) throw new Error(productsError.message);
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id as string]));

  const pricedLines = input.lines.map((line) => {
    const productId = productIdBySlug.get(line.productSlug);
    if (!productId) throw new Error(`Unknown product: ${line.productSlug}`);
    const unitPrice = priceForItem(line.productSlug, line.configuration);
    if (unitPrice === null || unitPrice <= 0) {
      throw new Error(`No price available for ${line.productSlug}`);
    }
    return { ...line, productId, unitPrice };
  });

  const totalAmount = pricedLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      client_id: input.clientId,
      created_by_id: staff.id,
      payment_method: "po",
      po_number: input.poNumber.trim() || null,
      status: "new_order",
      total_amount: totalAmount,
    })
    .select("id")
    .single();
  if (orderError) throw new Error(orderError.message);

  for (const line of pricedLines) {
    const { data: orderLine, error: lineError } = await supabase
      .from("order_lines")
      .insert({
        order_id: order.id,
        product_id: line.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
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

  revalidatePath("/admin");
  return { orderId: order.id as string };
}
