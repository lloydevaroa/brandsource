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
- **Checkout & payment (Stripe)**: `/api/checkout/session` signs in the customer (Clerk), upserts their `profiles` row, creates `orders` (status `draft`) + `order_lines` (real flat prices), links staged artwork to the resulting order lines, then creates a Stripe Checkout Session and returns its URL for the browser to redirect to. `/api/checkout/webhook` verifies the Stripe signature on `checkout.session.completed`, marks the order `paid` (`stripe_payment_intent_id`, `total_amount`), and creates one `sub_orders` row per order line at status `payment_received` — this is the first point sub-orders (and the staff Kanban) see the order. Abandoned/unpaid checkouts stay `draft` and are hidden from the customer's `/account` order list. Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (not yet set in this deployment — see Auth & data below).
- **Customer account** (`/account`): shows the signed-in customer's own quote requests and their current stage.
- **Staff dashboard** (`/admin`): Kanban board of all `sub_orders` by status, one card per order line (product, config, qty, customer, artwork count), inline controls to change status and claim/assign to a staff member (`claimed_by`). Gated to Clerk roles `admin`/`manager` — see `supabase/clerk-sync.md` for how to grant staff access.
- **Auth**: Clerk, with role (`customer`/`admin`/`manager`) read from `publicMetadata.role` and synced into Supabase `profiles` on every visit to `/account`, `/admin`, or order submission.
- **Supplier pricing research**: `supabase/supplier-pricing-research.sql` — a `supplier_pricing_research` table capturing what Trends.nz (Joe's supplier account) actually charges for each of the 7 categories (cost at qty 1/5/10, their own suggested-retail markup as a sanity check), to inform flat pricing decisions. Run once in the SQL editor.
- **Responsive header**: collapses to a hamburger menu below the `sm` breakpoint.
- **Unit prices**: all 7 SKUs now have a flat `unit_price` (Supabase `products`, `src/data/catalog.ts`, and `supabase/seed.sql` all in sync). Basis: Trends' own suggested-retail figure at qty 10 where `supplier_pricing_research` captured one (table-covers, feather-teardrop-flags, banner-stands); for the other four (lanyards, custom-buttons, both LED lightboxes, which only had a qty-10 cost) — Trends' qty-10 markup rate (cost x 1.55) applied to that cost. Project owner confirmed using Trends pricing directly as the V1 basis rather than a separate quote (2026-09-16).
- **Not yet built**: Stripe keys aren't set on this deployment yet (checkout code is in place but untested end-to-end — see Auth & data below), Resend transactional emails.

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
3. Create a [Stripe](https://dashboard.stripe.com) account (test mode is fine for now). Grab the secret key from API keys, and create a webhook endpoint pointing at `<your-deployment>/api/checkout/webhook` for the `checkout.session.completed` event to get the webhook signing secret. Locally, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe listen --forward-to localhost:8084/api/checkout/webhook`) instead of a dashboard webhook.
4. Copy `.env.example` → `.env.local` and fill keys (also add the same to Vercel → Settings → Environment Variables).
5. `npm run dev` — homepage/cart stay public; `/account` and `/admin` require sign-in (`/admin` also requires the staff role); checkout requires Stripe keys to be set.

## Next slices

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (test mode first) so checkout can actually be exercised end-to-end
2. Resend transactional emails (order confirmation, stage-change notifications)

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
