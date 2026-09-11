# BRANDSource

NZ branded merchandise platform (working name for Brand Spanking) — Trade Show & Events pilot competing with ImprintNow on **local suppliers + human proofing**, not feature parity.

**Repo:** https://github.com/lloydevaroa/brandsource

## V1 scope (locked)

- Catalog: 7 Trade Show SKUs (configurator, flat pricing, static example imagery)
- Fulfilment: order shell → **sub-orders** per supplier; supplier abstraction (`api` / `email_po` / `manual_portal`)
- Ops: admin Kanban against 9-stage sub-order lifecycle
- Proofing: human upload → proof → approve (no live artwork render)
- Stack: Next.js · Vercel · Supabase · Clerk · Stripe · Resend · shadcn/ui · dnd-kit
- **Xero deferred** until Project Owner briefs requirements
- Supplier commercial outreach owned by Brand Source Project Owner

## Local

```bash
npm install
npm run dev
```

```bash
npm run build
```

## Database

Apply in Supabase SQL editor (or CLI):

1. `supabase/schema.sql`
2. `supabase/seed.sql`

App currently seeds the UI from `src/data/catalog.ts` so the homepage/configurators work before Supabase/Clerk/Stripe are wired.

## Next slices

1. Supabase project + env · Clerk roles (customer / admin / manager)
2. Stripe checkout (SAQ-A) · artwork upload to Supabase storage
3. Admin Kanban (dnd-kit) for sub-orders
4. Resend transactional emails
5. PO unit prices into catalog

## SKUs

| Slug | Product |
| --- | --- |
| `table-covers` | Custom rectangle table covers |
| `vinyl-banners` | Custom vinyl banners |
| `feather-teardrop-flags` | Feather & teardrop flags |
| `banner-stands` | Banner stands |
| `lanyards` | Full-colour sublimation lanyards |
| `custom-buttons` | Custom buttons (MOQ 50) |
| `popup-banners` | Pop-up banners |
