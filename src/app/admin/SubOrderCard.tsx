"use client";

import { useState, useTransition } from "react";
import type { SubOrderStatus } from "@/lib/types";
import { STATUS_ORDER, STATUS_LABEL } from "./status";

export type StaffOption = { id: string; full_name: string | null };

export type SubOrderCardData = {
  id: string;
  status: SubOrderStatus;
  claimedBy: string | null;
  createdAt: string;
  productName: string;
  quantity: number;
  configuration: Record<string, string | string[]>;
  customerName: string | null;
  customerEmail: string | null;
  artworkCount: number;
  /** Set (to the PO number, or "PO" if none given) for managed-client PO orders. */
  poNumber: string | null;
};

export function SubOrderCard({
  subOrder,
  staff,
  onUpdateStatus,
  onClaim,
}: {
  subOrder: SubOrderCardData;
  staff: StaffOption[];
  onUpdateStatus: (id: string, status: SubOrderStatus) => Promise<void>;
  onClaim: (id: string, claimedBy: string | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const configSummary = Object.entries(subOrder.configuration)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" · ");

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
      <p className="font-medium">
        {subOrder.productName} × {subOrder.quantity}
      </p>
      {configSummary ? <p className="mt-1 text-xs text-zinc-500">{configSummary}</p> : null}
      <p className="mt-2 text-xs text-zinc-600">
        {subOrder.customerName ?? subOrder.customerEmail ?? "Unknown customer"}
        {subOrder.poNumber ? (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {subOrder.poNumber}
          </span>
        ) : null}
      </p>
      <p className="text-xs text-zinc-400">
        {new Date(subOrder.createdAt).toLocaleDateString("en-NZ")}
        {subOrder.artworkCount > 0
          ? ` · ${subOrder.artworkCount} artwork file${subOrder.artworkCount === 1 ? "" : "s"}`
          : " · no artwork yet"}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <select
          value={subOrder.status}
          disabled={isPending}
          onChange={(e) => {
            setError(null);
            startTransition(async () => {
              try {
                await onUpdateStatus(subOrder.id, e.target.value as SubOrderStatus);
              } catch {
                setError("Could not update status");
              }
            });
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={subOrder.claimedBy ?? ""}
          disabled={isPending}
          onChange={(e) => {
            setError(null);
            startTransition(async () => {
              try {
                await onClaim(subOrder.id, e.target.value || null);
              } catch {
                setError("Could not update assignee");
              }
            });
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? "Unnamed staff"}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </li>
  );
}
