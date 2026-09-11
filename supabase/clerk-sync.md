# Clerk ↔ Supabase profiles

1. Run `schema.sql` then `seed.sql` in the Supabase SQL editor.
2. On first sign-in, upsert `profiles` with `clerk_user_id` + email (API route TBD).
3. Map Clerk publicMetadata.role → `user_role` (`customer` | `admin` | `manager`).
