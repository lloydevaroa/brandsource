"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { notifyManufacturingBegun, notifyManufacturingFinished, notifyDeliveryCompleted } from "@/lib/notifications";
import type { SubOrderStatus } from "@/lib/types";

async function requireStaffProfile() {
  const profile = await syncCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Not authorised");
  }
  return profile;
}

const IN_PROGRESS_STATUSES: SubOrderStatus[] = ["sent_to_supplier", "in_production", "dispatched"];

/**
 * Rolls sub-order statuses up to the order-level status shown on the
 * overview (item 3) — coarser than the Kanban, not a duplicate of it.
 * Never touches an order already marked 'invoiced': that's a one-way,
 * independent flag set by the future Xero push (item 5), not something
 * sub-order progress should downgrade.
 */
const DISPATCHED_OR_BEYOND: SubOrderStatus[] = ["dispatched", "completed"];

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

  const { data: subOrders } = await supabase.from("sub_orders").select("status").eq("order_id", orderId);
  if (!subOrders || subOrders.length === 0) return;

  const isManagedClient = order.payment_method === "po";
  const allCompleted = subOrders.every((s) => s.status === "completed");
  const anyInProgress = subOrders.some((s) => IN_PROGRESS_STATUSES.includes(s.status as SubOrderStatus));
  const allDispatchedOrBeyond = subOrders.every((s) => DISPATCHED_OR_BEYOND.includes(s.status as SubOrderStatus));
  const nextStatus = allCompleted ? "completed" : anyInProgress ? "in_production" : "new_order";

  if (nextStatus !== order.status) {
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    if (isManagedClient && nextStatus === "in_production") await notifyManufacturingBegun(orderId);
    if (isManagedClient && nextStatus === "completed") await notifyDeliveryCompleted(orderId);
  }

  // "Manufacturing finished" doesn't correspond to an order_status value of
  // its own (order_status only distinguishes in_production/completed), so
  // it needs its own once-only flag rather than a status-transition check.
  if (isManagedClient && !order.manufacturing_finished_notified_at && allDispatchedOrBeyond) {
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
