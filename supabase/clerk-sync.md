# Clerk ↔ Supabase profiles

1. Run `schema.sql` then `seed.sql` in the Supabase SQL editor.
2. Implemented in `src/lib/supabase/profile.ts` (`syncCurrentProfile`): every
   time a signed-in user hits `/account`, `/admin`, or submits a quote
   request, their `profiles` row is upserted by `clerk_user_id` (email, full
   name, role).
3. Role comes from Clerk `publicMetadata.role` (`customer` | `admin` |
   `manager`) — **set this in the Clerk dashboard**, not in Supabase directly,
   since it's overwritten from Clerk on every sync. To make someone staff:
   Clerk dashboard → Users → the user → Metadata → Public → `{"role": "manager"}`.
4. Staff dashboard lives at `/admin` (Kanban by `sub_orders.status`, claim via
   `claimed_by`) — gated to `admin`/`manager` roles only.
