-- Team dashboard board simplified (11 Oct 2026): three columns (New order,
-- Processing, Completed) with a tick-list on each card. Run once in the
-- Supabase SQL editor. Safe to re-run.
--
-- The sub_order_status enum is left alone. Only new_order, in_production
-- (shown as "Processing") and completed are written from now on.

alter table public.sub_orders
  add column if not exists checklist jsonb not null default '{}'::jsonb;

-- Turn each item's old stage into ticks (only rows that have none yet).
update public.sub_orders set checklist = case status::text
  when 'payment_received'        then '{"payment_received":true}'
  when 'artwork_required'        then '{"payment_received":true}'
  when 'proof_awaiting_approval' then '{"payment_received":true,"artwork_received":true}'
  when 'ready_to_order'          then '{"payment_received":true,"artwork_received":true,"proof_approved":true}'
  when 'sent_to_supplier'        then '{"payment_received":true,"artwork_received":true,"proof_approved":true,"ordered_from_supplier":true}'
  when 'in_production'           then '{"payment_received":true,"artwork_received":true,"proof_approved":true,"ordered_from_supplier":true,"in_production":true}'
  when 'dispatched'              then '{"payment_received":true,"artwork_received":true,"proof_approved":true,"ordered_from_supplier":true,"in_production":true,"dispatched":true}'
  when 'completed'               then '{"payment_received":true,"artwork_received":true,"proof_approved":true,"ordered_from_supplier":true,"in_production":true,"dispatched":true}'
  else '{}'
end::jsonb
where checklist = '{}'::jsonb;

-- Everything between New order and Completed is now Processing.
update public.sub_orders
set status = 'in_production'
where status::text not in ('new_order', 'completed', 'in_production');
