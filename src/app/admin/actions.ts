"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
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
async function recomputeOrderStatus(
  supabase: ReturnType<typeof createServiceSupabase>,
  orderId: string
) {
  const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (!order || order.status === "invoiced") return;

  const { data: subOrders } = await supabase.from("sub_orders").select("status").eq("order_id", orderId);
  if (!subOrders || subOrders.length === 0) return;

  const allCompleted = subOrders.every((s) => s.status === "completed");
  const anyInProgress = subOrders.some((s) => IN_PROGRESS_STATUSES.includes(s.status as SubOrderStatus));
  const nextStatus = allCompleted ? "completed" : anyInProgress ? "in_production" : "new_order";

  if (nextStatus !== order.status) {
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
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
