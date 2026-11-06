"use client";

import { useState } from "react";

/** Staff only: email the customer a reminder for every product still missing artwork. */
export function StaffReminderButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/artwork-reminder`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { ok: true, text: `Reminder sent to ${data.sentTo} for ${data.items} item${data.items === 1 ? "" : "s"}.` }
          : { ok: false, text: data.error ?? "Could not send the reminder." }
      );
    } catch {
      setMessage({ ok: false, text: "Could not send the reminder. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Staff: chase this customer for artwork</p>
      <p className="mt-1 text-xs text-amber-800">
        Emails the customer a list of the products still missing artwork, with a link to this page.
      </p>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Email artwork reminder"}
      </button>
      {message ? (
        <p className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}
