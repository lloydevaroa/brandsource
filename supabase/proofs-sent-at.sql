-- Proofs are attached first and sent to the customer by a separate button.
-- sent_at is when the proof was released to the customer (emailed and shown on their order page).
alter table public.proofs add column if not exists sent_at timestamptz;

-- Proofs attached before this change were emailed straight away, so count them as sent.
update public.proofs set sent_at = created_at where sent_at is null;
