/** Shown on products from a supplier whose listing is still a sample, pending approval. */
export function SampleBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 ${className}`}
    >
      {label}
    </span>
  );
}
