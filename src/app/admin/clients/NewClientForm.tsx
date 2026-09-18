"use client";

import { useState, useTransition } from "react";
import { createManagedClient } from "./actions";

export type StaffOption = { id: string; full_name: string | null };

const CREDIT_TERMS = [7, 14, 30] as const;

export function NewClientForm({ staff }: { staff: StaffOption[] }) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accountManagerId, setAccountManagerId] = useState(staff[0]?.id ?? "");
  const [creditTermDays, setCreditTermDays] = useState<number>(14);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustAdded(false);
    startTransition(async () => {
      try {
        await createManagedClient({ name, accountManagerId, creditTermDays, contactEmail });
        setName("");
        setContactEmail("");
        setJustAdded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create client.");
      }
    });
  }

  if (staff.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No staff accounts found — a client needs an account manager, and only staff
        (admin/manager) profiles can be one. Sign in as a staff member at least once first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold">New managed client</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Business name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            placeholder="e.g. Papatoetoe Glass"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            placeholder="orders@client.co.nz"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Account manager</span>
          <select
            value={accountManagerId}
            onChange={(e) => setAccountManagerId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? "Unnamed staff"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Credit terms</span>
          <select
            value={creditTermDays}
            onChange={(e) => setCreditTermDays(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          >
            {CREDIT_TERMS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {justAdded ? <p className="mt-3 text-sm text-emerald-600">Client added.</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add client"}
      </button>
    </form>
  );
}
