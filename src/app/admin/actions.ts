"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { notifyManufacturingBegun, notifyManufacturingFinished, notifyDeliveryCompleted } from "@/lib/notifications";
import type { SubOrderStatus } from "@/lib/types";
import { CHECKLIST_ITEMS, COLUMN_STATUS, boardColumn, effectiveChecklist, rollupOrder, type ChecklistKey } from "./status";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

/**
 * Rolls item progress up to the order-level status shown on Orders & reports
 * (see rollupOrder). Never touches an order already marked 'invoiced': that's a
 * one-way flag set by the Xero push, not something item progress should downgrade.
 */
async function loadSubOrders(supabase: ReturnType<typeof createServiceSupabase>, orderId: string) {
  const withChecklist = await supabase.from("sub_orders").select("status, checklist").eq("order_id", orderId);
  if (!withChecklist.error) return withChecklist.data ?? [];
  // supabase/checklist.sql not run yet: fall back to the status alone.
  const plain = await supabase.from("sub_orders").select("status").eq("order_id", orderId);
  return (plain.data ?? []) as { status: string; checklist?: unknown }[];
}

async function recomputeOrderStatus(
  supabase: ReturnType<typeof createServiceSupabase>,
  orderId: string
) {
  const { data: order } = await supabase
    .from("orders")
    .select("status, payment_method, manufacturing_finished_notified_at")
    .eq("id", orderId)
    .single();
  if (!order || order.status === "invoiced") return;

  const subOrders = await loadSubOrders(supabase, orderId);
  if (subOrders.length === 0) return;

  const isManagedClient = order.payment_method === "po";
  const { status: nextStatus, finished } = rollupOrder(subOrders);

  if (nextStatus !== order.status) {
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    if (isManagedClient && nextStatus === "in_production") await notifyManufacturingBegun(orderId);
    if (isManagedClient && nextStatus === "completed") await notifyDeliveryCompleted(orderId);
  }

  // "Manufacturing finished" doesn't correspond to an order_status value of
  // its own, so it needs its own once-only flag rather than a status-transition check.
  if (isManagedClient && !order.manufacturing_finished_notified_at && finished) {
    await supabase
      .from("orders")
      .update({ manufacturing_finished_notified_at: new Date().toISOString() })
      .eq("id", orderId);
    await notifyManufacturingFinished(orderId);
  }
}

export async function updateSubOrderStatus(subOrderId: string, status: SubOrderStatus) {
  await requireStaffProfile();
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("sub_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subOrderId)
    .select("order_id")
    .single();
  if (error) throw new Error(error.message);
  await recomputeOrderStatus(supabase, data.order_id);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

/**
 * Ticks or unticks one item on a card. Ticking anything on a New order card
 * moves it to Processing; unticking never moves it back, and Completed is
 * always a deliberate move (it sends the "delivered" email and unlocks Xero).
 */
export async function setChecklistItem(subOrderId: string, key: ChecklistKey, checked: boolean) {
  await requireStaffProfile();
  if (!CHECKLIST_ITEMS.some((i) => i.key === key)) throw new Error("Unknown checklist item");
  const supabase = createServiceSupabase();

  const { data: current, error: readError } = await supabase
    .from("sub_orders")
    .select("order_id, status, checklist")
    .eq("id", subOrderId)
    .single();
  if (readError) throw new Error(readError.message);

  const checklist = { ...effectiveChecklist(current.status, current.checklist), [key]: checked };
  const update: { checklist: typeof checklist; status?: SubOrderStatus; updated_at: string } = {
    checklist,
    updated_at: new Date().toISOString(),
  };
  if (checked && boardColumn(current.status) === "new_order") update.status = COLUMN_STATUS.processing;

  const { error } = await supabase.from("sub_orders").update(update).eq("id", subOrderId);
  if (error) throw new Error(error.message);
  await recomputeOrderStatus(supabase, current.order_id);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function claimSubOrder(subOrderId: string, claimedBy: string | null) {
  await requireStaffProfile();
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("sub_orders")
    .update({ claimed_by: claimedBy, updated_at: new Date().toISOString() })
    .eq("id", subOrderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
