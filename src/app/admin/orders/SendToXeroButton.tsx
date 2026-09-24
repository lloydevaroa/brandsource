"use client";

import { useState, useTransition } from "react";
import { sendOrderToXero } from "./actions";

export function SendToXeroButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await sendOrderToXero(orderId);
            if ("error" in result) setError(result.error);
          });
        }}
        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium hover:border-zinc-400 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send to Xero"}
      </button>
      {error ? <p className="mt-1 max-w-48 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
