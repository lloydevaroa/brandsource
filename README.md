# BRANDSource

NZ branded merchandise platform (working name for Brand Spanking) — Trade Show & Events pilot competing with ImprintNow on **local suppliers + human proofing**, not feature parity.

**Repo:** https://github.com/lloydevaroa/brandsource

## V1 scope (locked)

- Catalog: 7 Trade Show SKUs (configurator, flat pricing, static example imagery)
- Fulfilment: order shell → **sub-orders** per supplier; supplier abstraction (`api` / `email_po` / `manual_portal`)
- Ops: admin Kanban against 9-stage sub-order lifecycle
- Proofing: human upload → proof → approve (no live artwork render)
- Stack: Next.js · Vercel · Supabase · Clerk · Stripe · Resend
- **Xero deferred** until Project Owner briefs requirements
- Supplier commercial outreach owned by Brand Source Project Owner

## Shipped (as of 2026-09-16)

- **Catalog & configurator**: 7 products, each with option groups/choices, served from `src/data/catalog.ts` (mirrors `products`/`option_groups`/`option_choices` in Supabase). Product pages statically generated at `/products/[slug]`.
- **Cart**: client-side (`localStorage`), quantity + per-item artwork upload to a private Supabase Storage bucket (`/api/artwork/upload`, staged under `staged/{cartItemId}/...` ahead of order creation).
- **Quote-request submission**: `/api/orders/submit` — signs in the customer (Clerk), upserts their `profiles` row, creates `orders` + `order_lines` + `sub_orders` (status `new_order`), links staged artwork to the resulting order line. No payment collected yet — pricing is still TBD from the Project Owner, so orders exist before payment (`new_order` → `payment_received` are separate stages by design).
- **Customer account** (`/account`): shows the signed-in customer's own quote requests and their current stage.
- **Staff dashboard** (`/admin`): Kanban board of all `sub_orders` by status, one card per order line (product, config, qty, customer, artwork count), inline controls to change status and claim/assign to a staff member (`claimed_by`). Gated to Clerk roles `admin`/`manager` — see `supabase/clerk-sync.md` for how to grant staff access.
- **Auth**: Clerk, with role (`customer`/`admin`/`manager`) read from `publicMetadata.role` and synced into Supabase `profiles` on every visit to `/account`, `/admin`, or order submission.
- **Supplier pricing research**: `supabase/supplier-pricing-research.sql` — a `supplier_pricing_research` table capturing what Trends.nz (Joe's supplier account) actually charges for each of the 7 categories (cost at qty 1/5/10, their own suggested-retail markup as a sanity check), to inform flat pricing decisions. Run once in the SQL editor.
- **Responsive header**: collapses to a hamburger menu below the `sm` breakpoint.
- **Not yet built**: Stripe checkout/payment (blocked on Joe's flat pricing), Resend transactional emails, PO unit prices into the catalog.

## Local

```bash
npm install
npm run dev
```

```bash
npm run build
```

## Database

Apply in the Supabase SQL editor, in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/supplier-pricing-research.sql`

The storefront (catalog browsing, configurator) reads from `src/data/catalog.ts` directly, not Supabase — it's kept in sync with `seed.sql` by hand. Orders, sub-orders, profiles, artwork and pricing research all live in Supabase.

## Auth & data

1. Create a [Clerk](https://dashboard.clerk.com) application (Next.js). To grant staff access, set a user's `publicMetadata.role` to `admin` or `manager` in the Clerk dashboard — self-serve sign-up always defaults to `customer`.
2. Create a [Supabase](https://supabase.com/dashboard) project; run, in order: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/supplier-pricing-research.sql`.
3. Copy `.env.example` → `.env.local` and fill keys (also add the same to Vercel → Settings → Environment Variables).
4. `npm run dev` — homepage/cart stay public; `/account` and `/admin` require sign-in (`/admin` also requires the staff role).

## Next slices

1. Stripe checkout + payment collection once the Project Owner sends flat unit prices for the 7 SKUs (`supabase/supplier-pricing-research.sql` has Trends' cost data as a sanity check)
2. Resend transactional emails (order confirmation, stage-change notifications)
3. PO unit prices into the catalog (`products.unit_price`, currently null on all 7)

## SKUs

| Slug | Product |
| --- | --- |
| `table-covers` | Custom rectangle table covers |
| `led-lightbox-bannerstand` | LED lightbox bannerstand |
| `feather-teardrop-flags` | Feather & teardrop flags |
| `banner-stands` | Banner stands |
| `lanyards` | Full-colour sublimation lanyards |
| `custom-buttons` | Custom buttons (MOQ 50) |
| `led-lightbox-counter` | LED lightbox counter |
