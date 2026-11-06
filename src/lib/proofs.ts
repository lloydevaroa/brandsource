export type ProofStatus = "awaiting_approval" | "approved" | "changes_requested";

export type ProofSummary = {
  id: string;
  name: string;
  status: ProofStatus;
  note: string | null;
  createdAt: string;
  /** When the proof was released to the customer; null while it is only attached. */
  sentAt: string | null;
  /** Temporary link to open the file (the bucket is private), or null if one could not be made. */
  url: string | null;
};

export function isImageName(name: string) {
  return /\.(png|jpe?g|webp|svg)$/i.test(name);
}

/** Newest first, so the first one is the proof the customer is being asked about. */
export function newestFirst<T extends { created_at: string }>(proofs: T[]) {
  return [...proofs].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
