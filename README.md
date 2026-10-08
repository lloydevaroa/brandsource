# BRANDSource

NZ branded merchandise platform (working name for Brand Spanking) — Trade Show & Events pilot competing with ImprintNow on **local suppliers + human proofing**, not feature parity.

**Repo:** https://github.com/lloydevaroa/brandsource

> **Have a request, bug or to-do?** Add a line to [`JOE-TODO.md`](JOE-TODO.md) under "Inbox". Lloyd triages it from there. Please don't edit the status section below.

---

# Project status (owner view)

> **For Joe and Joe's Claude.** This section is the plain-English answer to "what is going on, what has happened, and what is due next". Start here. The technical detail further down is for whoever is changing the code. Lloyd (Really Good Marketing) keeps this section current with every batch of work; if the date below is stale, say so.
>
> **Last updated: 8 Oct 2026 (staff can upload and manage product images for non-Trends suppliers, suppliers can now be added and controlled in the admin, every product records its supplier, TLC banner and stretch fabric sample range ready to load; Trends cost pricing ready to load, 535 existing clients loaded)**

**Suggested questions for Claude:** "What happened this week?" · "What is blocked on me?" · "What's due next?" · "Is the live site ready to take real money, and if not, what's left?" · "If Lloyd were unavailable tomorrow, what would I need to do?"

## Where things stand

BrandSource is a working **staging site** at brandsource-seven.vercel.app. It runs on test payments, a development sign-in instance and test data, so no real money moves yet. The managed-client purchase-order path (staff create an order for a client, it flows to the production board, emails go out at four milestones, finished orders push to Xero, CSV reports) is built. The product catalogue is now being loaded from Trends and organised into storefront categories.

## Now (week of 5 Oct 2026)

- Product images: products with no image are now hidden from the website (menus, category pages and their product page), and the team dashboard shows an amber banner counting them with a link to fix. Bulk upload: drop a batch of images and they match to products by file name ("Hanging Banner - 1.jpg"), with a type-to-pick list for any that don't match. Large photos are shrunk automatically. Also: a Product images screen in the team dashboard (`/admin/product-images`) lets staff upload photos to any product, reorder them (the first is the main image) and remove them. It shows non-Trends suppliers by default, since Trends images come from its catalogue.
- Suppliers: a new Suppliers screen in the team dashboard (`/admin/suppliers`) adds and edits suppliers, and every product now records which supplier it comes from (Trends, TLC and so on). The supplier is internal and never shown to customers.
- TLC Live sample range: 4 stretch fabric display products from TLC's product guide, ready to load as a clearly marked "TLC sample" so the client can see them in the draft site while TLC agrees to usage and hosting. One switch per supplier turns the badge off (approved), hides the range (withdrawn) or brings it back.

- Trends catalogue import: products, images and supplier details load into the database, with new products placed into storefront categories by name.
- Storefront now reads products from the database (previously a hand-maintained file), has category pages, and the homepage is the Trade Show & Events tile page.
- Product pages: richer supplier detail, square uncropped images, clickable thumbnails.
- New admin screen to assign products to categories, for anything the automatic placement misses.

## Next / due

Items marked **Joe** need his accounts or a decision. Full go-live order is under "Handover" below.

| What | Who | Status |
| --- | --- | --- |
| Test Xero end to end: complete a test PO order and check the draft invoice appears in Xero with the right account code and GST | Lloyd + **Joe** | Connected 2 Oct, not yet tested with a real order |
| Resend domain verification (Crazy Domains must publish one DKIM record) | **Joe** | Pending since 23 Sep. Order emails won't reach real inboxes until done |
| Vercel plan decision (Pro trial started 15 Sep, would have ended about 29 Sep) | **Joe** / Lloyd | Check the plan status in Vercel |
| Review how imported Trends products landed in categories (`/admin`) | Lloyd / Joe | New 2 Oct |
| Split staging from production keys in Vercel, move the domain, create Clerk production instance, activate live Stripe, paid Supabase plan, clear test data | Lloyd + **Joe** | Not started. See the go-live list below |
| Move GitHub, Vercel, Supabase and Clerk into accounts BrandSource owns | **Joe** / Lloyd | Recommended, not started (key redundancy step) |
| Load the supplier system and the TLC sample range: run `supabase/suppliers.sql` once in the Supabase SQL editor, then `node --env-file=.env.local scripts/tlc-import.mjs`. Then ask TLC to agree to usage and hosting, and send us their original product photos. When TLC approves, press Approve on TLC at `/admin/suppliers`; if they decline, press Withdraw or run the import with `--remove` | Lloyd | Built 8 Oct, not yet loaded |
| Check the loaded clients (535 names from Joe's Xero contact list, exactly as in Xero). Add contact emails and an account manager over time at `/admin/clients`. Two spellings to confirm in Xero: the four brandspanking.co.nz email-named contacts were left out | Lloyd + **Joe** | Loaded 5 Oct |
| Write an internal testing plan (started in [`TESTING.md`](TESTING.md): PO order to Xero draft invoice, card purchase, account manager order progression): who tests what, on which device, and what counts as pass. Cover PO order to Xero invoice, card checkout, order emails, staff roles, categories, hero images, mobile | Lloyd + **Joe** | Not started. The site is close to internal testing, so this is next |
| Trends cost pricing (quantity breaks, setup and extra charges, below-minimum flag, notes) for the 90 imported products: run `supabase/supplier-pricing.sql` once, then the pricing import. Cost only, never shown to customers | Lloyd | Loaded 6 Oct |
| Confirm the selling price rule. Interim prices set 6 Oct: lowest-quantity Trends cost plus 60% (Trends' own suggested markup), rounded up to retail-style endings by band (under $10 nearest 5c, $10 to $100 ending .95, $100 to $1,000 ending 4.95 or 9.95, over $1,000 ending 9), excluding setup fees and extras and shown ex-GST. Joe to confirm or change; adjust single products in the admin | **Joe** / Lloyd | Interim, for testing |
| Monitor the Trends catalogue for removed or changed products (nightly check, weekly full sweep, alert email, hide rather than delete) | Lloyd | Designed 3 Oct, not built. See `build-brief.md` |

## What has happened (newest first)

**Week of 5 Oct**
- 8 Oct: Product images, round two. No image now means the product is hidden from the storefront, with a banner on the team dashboard counting the hidden products. Added bulk upload that matches files to products by name, with a picker for the rest, and automatic shrinking of large photos. Staff can still add hidden products to orders.
- 8 Oct: Added a Product images screen to the team dashboard so Joe can upload, reorder and remove product photos himself for suppliers other than Trends (call action C1). No database step needed; it uses the existing product image storage. Uploaded photos show on the product page within a minute.
- 8 Oct: Narrowed the TLC sample to the 4 stretch fabric displays (standard, hanging, table top, shelving) and removed the 15 TLC banner products, at Lloyd's request. The import script now loads only the stretch fabric range; the banner data stays in the vault in case it is wanted later.
- 8 Oct: Added a supplier system. A Suppliers screen in the team dashboard adds and edits suppliers (contact details, how we order, notes) and each supplier has a listing status: Live, Sample (shows a badge such as "TLC sample" on its products until the supplier approves) or Withdrawn (hides all its products straight away, reversible). Every product records its supplier, shown to staff only; the Trends name stays off the storefront as the Trends terms require. Built a TLC Live sample import of 19 banner and stretch fabric products (46 images cropped from TLC's 2024 product guide, no prices, quote only), under two new customer-language categories, Banners and Stretch Fabric Displays (pull-up banners also sit in Banner Stands, tear drop and wing banners also in Flags). Until the one-off database step is run the storefront carries on exactly as before. TLC's artwork is placeholder-quality in places; their original photos are needed before launch.
- 5 Oct: Loaded 20 more products from Trends, 90 live in total, aimed at the homepage categories that were empty. Banners & Displays now has 11 (the banner stands and display walls we already had are now also shown there, plus the 6m display wall), Awards has 11 (lapel pins and badges, personalised ribbons), Tickets has 6 (event wrist bands) and Cards has 3 (business, loyalty and playing cards). Trends does not sell trophies or medals, so Awards is badges and ribbons for now; real trophies would need another supplier. Still empty (now hidden from the homepage): Event & Promotion Inflatables, Tents, Inflatable Tents and Auction Paddles (Trends has no range for these either).
- 5 Oct: Started the testing plan in `TESTING.md` with three scenarios: pick a client, raise a purchase-order order and send a draft invoice to Xero (including what happens when a client name doesn't match Xero); a customer buying with a card through Stripe test mode; and an account manager moving an order from new to completed, including the client emails.
- 5 Oct: Loaded BrandSource's 535 existing clients (from Joe's Xero contact list, names exactly as in Xero) so account managers can pick any of them when raising a purchase-order order. Payment terms are no longer stored in BrandSource: Xero holds them, and the draft invoice is sent without a due date so Xero applies each customer's own terms. Account manager on a client is now optional, since any staff member can raise an order for any client. Draft orders to a Xero draft invoice still needs its first end-to-end test.

**Week of 28 Sep**
- 3 Oct: Planned Trends catalogue change monitoring (nightly check for changed or discontinued products, weekly sweep for ones that vanish, alert email, products hidden pending review rather than deleted). Not built yet. Also added "import existing clients" and "set up a testing plan" to the build list.
- 3 Oct: Loaded 20 more products from Trends (lanyards, pens, tote bags, badges), 70 in total. Category tile images on the home page now show the whole picture instead of cropping it, so tall products like banner stands are no longer cut off. The tiles are now square, matching the square Trends images, so every tile looks uniform.
- 2 Oct: Added hero image sliders to the home page and every category page. Staff add, reorder, caption and remove images at Staff > Hero images (`/admin/hero`). Slides change by themselves every 6 seconds with arrows and dots; one image shows as a plain hero, none shows nothing. **Needs `supabase/hero-slides.sql` run once in the Supabase SQL editor before uploads work.**
- 2 Oct: Added a category navigation menu under the header. Sub-categories (Table Covers, Lanyards and so on) run across the bar, and each opens a dropdown of its products (an expandable list on mobile). Categories with no products yet are hidden until they have some.
- 2 Oct: Smoothed the Hero images screen: saving, saved and deleting states, error messages, a confirm before delete, clearer hover and keyboard focus, and a pointer cursor on every clickable control.
- 2 Oct: Joe connected BrandSource's Xero account to the site.
- 2 Oct: Added `JOE-TODO.md`, an inbox where Joe (or Joe's Claude) can log requests, bugs and questions. Lloyd triages them into the status table above.
- 2 Oct: Cleared out the original pilot products. Five were deleted (banner stands, custom buttons, lanyards and the two LED lightboxes), along with two extras (vinyl banners, pop-up banners). Table Covers and Feather Flags were only switched off, because three existing orders use them. Trends signage turned out to exist after all, so the catalogue grew to 30 live products, then 50, all showing "Get a quote".
- 2 Oct: Importer fixes. Trends products marked "New" were being treated as inactive, and a branding-template PDF that Trends refused to serve no longer stops an import (one product, the Portable Event Lightbox Bannerstand, has no template download). Batches now pause 1.5 seconds between requests to stay inside Trends' rate limits.
- 2 Oct: Trends importer and supplier tracking columns; catalogue read from the database; supplier detail on product pages; category pages; homepage is the tile page; admin screen to assign categories; Trends signage/display products auto-placed; thumbnails swap the main image.
- 29 Sep: Trends approved Really Good Marketing's developer access to their API. Image use for the storefront confirmed OK (still no Trends name or branding visible to customers).
- 25 Sep: Clerk "Device Trust" switched off in the development sign-in so Joe could log in. It must be **on** in production.

**Week of 21 Sep**
- 24 Sep: Xero push built for completed purchase-order orders (connected by Joe 2 Oct).
- 23 Sep: Stripe test mode verified end to end; Resend keys added; admin CSV reports (by customer, item, price); staff admin polish (team dashboard, client search, saving indicator).

**Week of 14 Sep**
- 18 Sep: Build pivoted to managed clients billed through Xero. Managed-client data model, account-manager PO order flow, order status overview, and the four email milestones (order received, manufacturing begun, manufacturing finished, delivered).
- 16 Sep: Flat unit prices set from Trends pricing; Stripe checkout added; mobile header.
- 15 Sep: Cart, product configurator and artwork upload; staff Kanban board; real product mockups.

**Week of 7 Sep**
- 11 Sep: Project scaffolded: catalogue of 7 trade show products, database design, Clerk sign-in.

## Handover (if Lloyd is unavailable)

**Who to call:** Lloyd Evaroa, Really Good Marketing, lloyd@reallygood.marketing. Any Claude Code session pointed at this repo can continue the work: read this README, `src/`, and `supabase/`.

**Where everything lives** (no passwords or keys are stored in this repo):

| Tool | Does | Today | Account owner |
| --- | --- | --- | --- |
| GitHub `lloydevaroa/brandsource` | Holds the code. Every push to `main` deploys. | Lloyd's personal account | Lloyd |
| Vercel (team BrandSource) | Runs the site; holds all keys as environment variables | brandsource-seven.vercel.app | Lloyd |
| Supabase | Database (products, orders, clients, staff) and artwork storage | One project, test data | Lloyd |
| Clerk | Customer and staff sign-in; staff role (`admin`/`manager`) set per person | Development instance | Lloyd |
| Stripe | Card payments | Test mode, in Brandspanking 2026 Limited's account | Joe |
| Resend | Order emails from orders@brandsource.co.nz | Free tier, domain verification pending | orders@ mailbox |
| ImprovMX | Forwards @brandsource.co.nz mail | Everything goes to Lloyd for now | Lloyd |
| Crazy Domains | Domain and DNS for brandsource.co.nz | Still points at an old placeholder server | Joe |
| Trends.nz | Supplier; product range, images, cost prices via their API | Lloyd has developer access (approved 29 Sep) | Joe |
| Xero | Receives finished orders for invoicing | Connected 2 Oct, untested with a real order | Joe |

**Redundancy steps, in order of value:**
1. Add Joe (or a BrandSource-owned account) as owner on GitHub, Vercel, Supabase and Clerk, so no login depends on Lloyd alone.
2. Change the ImprovMX forwarding to a BrandSource inbox.
3. Keep this README current. It is the memory of the project.

**Going live, in order:** (1) decide the Vercel plan; (2) move test keys to Preview and put live keys in Production; (3) point `brandsource.co.nz` at Vercel; (4) Clerk production instance with Device Trust **on**, then re-grant staff roles; (5) activate live Stripe and create the live webhook at `https://brandsource.co.nz/api/checkout/webhook`; (6) confirm Resend shows Verified; (7) move ImprovMX forwarding; (8) clear test orders and artwork, keep the catalogue; (9) paid Supabase plan with backups; (10) test the Xero invoice push with a real order (Xero is connected); (11) launch-day check: place and refund a small real card order, run a PO order to a real email, download each CSV, test staff and customer sign-in.

**Rules that must not be broken:** no Trends name or branding visible to customers (their API terms, clause 4.1l); imported Trends products and images must stay removable in one go (clause 8.2); `/api/checkout/webhook` must stay in the middleware's public-route list.

## How this section is kept up to date

Whoever changes the code updates "Now", "Next / due", "What has happened" and the "Last updated" date in the same commit. Plain English, newest first, no secrets.

## The tools, in plain English

You don't need to log into most of these day to day. This is what each one is, so the names in the sections above make sense.

| Tool | What it is, in one line |
| --- | --- |
| **GitHub** | The filing cabinet for the website's code, with a full history of every change. Nothing is ever really lost, and any change can be undone. |
| **Vercel** | The landlord of the website. It takes the code from GitHub and runs it on the internet, and every time new code is saved it updates the live site. Its dashboard shows whether the site is up and what changed. It also holds the secret keys that connect the other tools together. |
| **Supabase** | Holds the data. Every product, customer, order and client lives here, along with the artwork customers upload. Think of it as the business's database and file store. You can open it and see real orders without asking anyone. |
| **Clerk** | The front door and the staff badges. It looks after who can sign in and what they're allowed to see, so staff get the admin area and customers only see their own orders. It means we never store passwords ourselves. |
| **Stripe** | The card machine. It takes card payments and keeps card numbers off our systems entirely. It's in practice mode for now, so no real money moves. |
| **Resend** | The postal service for automatic emails: order received, manufacturing started, manufacturing finished, delivered. |
| **ImprovMX** | Mail forwarding. Emails sent to anything@brandsource.co.nz get passed on to a real inbox. |
| **Crazy Domains** | Where the brandsource.co.nz name is registered. It decides which server answers when someone types the address. |
| **Trends** | The supplier. The product range, images and cost prices come from them, and the site loads them in automatically through their system. Customers must never see their name. |
| **Xero** | The accounting software. When an order is finished, its details are sent here so an invoice can be raised. |
| **Next.js** | The toolkit the website itself is built with. A very common choice, which means any developer or AI can pick it up. |
| **Claude Code** | The AI assistant that Lloyd uses to write and change the code. Joe's own Claude can read this document, and the code, to answer questions at any time. |

**How they fit together:** a customer or staff member visits the website (run by Vercel, built from code in GitHub). Clerk checks who they are. Supabase remembers everything. Stripe takes payment, Resend sends the emails, Trends supplies the products, and Xero receives the invoice details. If any one of these is ever outgrown, it can be swapped without rebuilding the rest.

---

# Technical reference

## V1 scope (locked)

- Catalog: 7 Trade Show SKUs (configurator, flat pricing, static example imagery)
- Fulfilment: order shell → **sub-orders** per supplier; supplier abstraction (`api` / `email_po` / `manual_portal`)
- Ops: admin Kanban against 9-stage sub-order lifecycle
- Proofing: human upload → proof → approve (no live artwork render)
- Stack: Next.js · Vercel · Supabase · Clerk · Stripe · Resend
- **Xero push** built 2026-09-24 (see below); awaiting BrandSource's Xero connection
- Supplier commercial outreach owned by Brand Source Project Owner

## Shipped (as of 2026-09-18)

- **Managed-client data model**: `clients` table (`client_type` managed/direct, optional `account_manager_id` (the credit-terms field and its constraint were dropped 5 Oct; Xero holds payment terms) and `profiles.client_id` linking a signed-in contact to their organisation. `orders` gained `client_id`, `payment_method` (`card`/`po`), `po_number`, `created_by_id` (the account manager, when staff create on a client's behalf), and `status` is now a proper `order_status` enum (`draft`/`new_order`/`in_production`/`completed`/`invoiced`) instead of free text.
- **Managed-client PO flow**: `/admin/clients` (staff add a managed client: name, optional account manager and contact email) and `/admin/orders/new` (staff pick a client and build an order line-by-line off the same catalog/configurator data as the storefront, optional PO number) — submitting creates the order at `new_order` with `payment_method: 'po'` and its `sub_orders` immediately, no payment step, so it shows up on the `/admin` Kanban straight away with a PO badge. This is the first end-to-end path that doesn't need Stripe keys.
- **Order status overview**: `/admin/orders` — one row per order (client/customer, PO reference or card, order-level status, sub-order completion progress, total, created date), separate from the Kanban's per-sub-order detail. `orders.status` now actually advances as its sub-orders progress (`updateSubOrderStatus` rolls sub-order status up to the order: `new_order` → `in_production` once any sub-order reaches `sent_to_supplier`/`in_production`/`dispatched` → `completed` once all are), skipping orders already `invoiced` since that's a one-way flag the future Xero push owns.
- **Notification milestones (managed clients only)**: `src/lib/notifications.ts` sends via Resend at the four points from build-brief.md's client notification table — order received (fires from `/admin/orders/new`, also emails the account manager), manufacturing begun (order rolls to `in_production`), manufacturing finished (all sub-orders reach `dispatched`/`completed` — tracked with its own `orders.manufacturing_finished_notified_at` flag since it doesn't correspond to an `order_status` value on its own), and delivery completed (order rolls to `completed`). Requires `clients.contact_email` (new field, set per client at `/admin/clients`) and `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (not yet set in this deployment — same "built but untested end-to-end" position Stripe was in). Sending is best-effort: a missing key or a failed send is logged, never blocks the order/status action that triggered it. Direct-consumer notifications are a separate, later slice.

- **Catalog & configurator**: 7 products, each with option groups/choices, served from `src/data/catalog.ts` (mirrors `products`/`option_groups`/`option_choices` in Supabase). Product pages statically generated at `/products/[slug]`.
- **Cart**: client-side (`localStorage`), quantity + per-item artwork upload to a private Supabase Storage bucket (`/api/artwork/upload`, staged under `staged/{cartItemId}/...` ahead of order creation).
- **Checkout & payment (Stripe)**: `/api/checkout/session` signs in the customer (Clerk), upserts their `profiles` row, creates `orders` (status `draft`) + `order_lines` (real flat prices), links staged artwork to the resulting order lines, then creates a Stripe Checkout Session and returns its URL for the browser to redirect to. `/api/checkout/webhook` verifies the Stripe signature on `checkout.session.completed`, marks the order `paid` (`stripe_payment_intent_id`, `total_amount`), and creates one `sub_orders` row per order line at status `payment_received` — this is the first point sub-orders (and the staff Kanban) see the order. Abandoned/unpaid checkouts stay `draft` and are hidden from the customer's `/account` order list. Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — set in production (Stripe sandbox/test mode) and verified end-to-end 2026-09-23. `/api/checkout/webhook` must stay in the middleware's public-route list: Stripe calls it with no Clerk session, and the route verifies the Stripe signature itself.
- **Customer account** (`/account`): shows the signed-in customer's own quote requests and their current stage.
- **Staff dashboard** (`/admin`): Kanban board of all `sub_orders` by status, one card per order line (product, config, qty, customer, artwork count), inline controls to change status and claim/assign to a staff member (`claimed_by`). Gated to Clerk roles `admin`/`manager` — see `supabase/clerk-sync.md` for how to grant staff access.
- **Auth**: Clerk, with role (`customer`/`admin`/`manager`) read from `publicMetadata.role` and synced into Supabase `profiles` on every visit to `/account`, `/admin`, or order submission.
- **Supplier pricing research**: `supabase/supplier-pricing-research.sql` — a `supplier_pricing_research` table capturing what Trends.nz (Joe's supplier account) actually charges for each of the 7 categories (cost at qty 1/5/10, their own suggested-retail markup as a sanity check), to inform flat pricing decisions. Run once in the SQL editor.
- **Responsive header**: collapses to a hamburger menu below the `sm` breakpoint.
- **Unit prices**: all 7 SKUs now have a flat `unit_price` (Supabase `products`, `src/data/catalog.ts`, and `supabase/seed.sql` all in sync). Basis: Trends' own suggested-retail figure at qty 10 where `supplier_pricing_research` captured one (table-covers, feather-teardrop-flags, banner-stands); for the other four (lanyards, custom-buttons, both LED lightboxes, which only had a qty-10 cost) — Trends' qty-10 markup rate (cost x 1.55) applied to that cost. Project owner confirmed using Trends pricing directly as the V1 basis rather than a separate quote (2026-09-16).
- **Not yet built**: Stripe is live in test mode only (switch to live keys before taking real payments); Resend keys likewise not set yet (notification code is in place but untested end-to-end).

## Catalogue and storefront (added 2 to 3 Oct)

- **Import from Trends:** `scripts/trends-import.mjs` pulls products, images and supplier details through the Trends API into Supabase, copying images into BrandSource's own storage. `scripts/trends-add-batch.mjs` adds extra batches at a gentle pace; `scripts/trends-sample.mjs` pulls a sample. Needs `TRENDS_API_TOKEN`. The raw sample folder `trends-sample/` is gitignored because the Trends data is confidential. Imported products and images must stay removable in one go.
- **Pricing new Trends products (manual, 3 steps):** the import above brings in no prices, so a new product shows "Get a quote" until these are run, in order, all with `node --env-file=.env.local`: (1) `scripts/trends-import.mjs` (the product), (2) `scripts/trends-pricing-import.mjs` (Trends cost: quantity breaks, setup and extra charges, below-minimum flag, notes, into the private tables from `supabase/supplier-pricing.sql`), (3) `scripts/apply-markup-prices.mjs` (selling price = lowest-break cost plus 60%, rounded up by band: under $10 nearest 5c, $10 to $100 ending .95, $100 to $1,000 ending 4.95 or 9.95, over $1,000 ending 9; ex-GST, setup fees and extras excluded). Steps 2 and 3 read `trends-sample/products.json`, so a new product must be in that file first (`trends-add-batch.mjs` adds it). Step 3 only fills empty prices or ones it set itself, so hand-set prices are safe, and `--dry-run` previews it. These are interim prices until Joe confirms the rule.
- **Placement:** products land in categories by Trends category number, or by product name for signage and displays (Trends files these under one category). The importer only adds assignments, so manual ones survive a re-sync.
- **Imported size variants:** Trends lists each size as its own product. Only the Medium size of each was imported to keep the range varied; the rest are still in Trends.
- **Known rough edges:** signage products carry a single meaningless "White" colour option (plan: hide the colour option when there is only one); a Trends product that fits no Trade Show category (Budget Stubby Cooler) has not been placed or deactivated.
- **Storefront:** home page is the Trade Show & Events category tile page (square tiles, full image, white background); `/category/<slug>` pages; a category menu under the header with products in a dropdown (categories with no products are hidden); product pages with supplier detail and a clickable thumbnail gallery (`ProductGallery`); hero sliders on home and category pages, managed at `/admin/hero` (change every 6 seconds, arrows and dots); `/admin/categories` to assign products by hand.
- **Deploys:** every push to `main` deploys to the live staging site. To show the team a branch without touching it, Vercel needs the test keys copied into its Preview environment.
- **Joe's Claude and the database:** the site reaches Supabase through three environment variables in Vercel, with no login involved. A person (or their Claude) needs their own Supabase seat to see the data; sharing the keys would hand over admin access with no login.

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
4. `supabase/clients-and-po.sql` (then `supabase/clients-xero-terms.sql`, which drops credit terms) — managed-client/account-manager data model, and formalizes `orders.status` into a proper `order_status` enum (`draft` → `new_order` → `in_production` → `completed` → `invoiced`). Ahead of the managed-client PO flow, so `orders.payment_method`/`po_number`/`client_id` exist but nothing writes to them yet.
5. `supabase/notification-fields.sql` — `clients.contact_email` and `orders.manufacturing_finished_notified_at`, for the notification milestones above.
6. `supabase/categories.sql` — storefront categories (`categories`, `product_categories`), seeded with the 17 Trade Show & Events tiles and the 7 pilot products placed. Browse pages live at `/category/<slug>`; a category with no active products shows "Coming soon" until one is assigned. `scripts/trends-import.mjs` maps Trends category numbers to these slugs (`CATEGORY_MAP`) and only ever adds assignments, so ones made by hand survive a re-sync. Products with no price show "Get a quote". Staff assign products to categories at `/admin/categories`.

7. `supabase/supplier-import.sql` and `supabase/product-details.sql`: supplier tracking columns and richer product detail for the Trends import.
8. `supabase/xero.sql`: Xero connection and invoice tracking.
9. `supabase/hero-slides.sql`: hero image sliders for the home and category pages. Must be run once before staff can upload images at `/admin/hero`.

Since 2 Oct the storefront reads products from Supabase, not `src/data/catalog.ts`. `catalog.ts` and `scripts/sync-catalog-to-db.mjs` remain only as the source of the original pilot products. Orders, sub-orders, profiles, artwork, categories, products and hero images all live in Supabase.

## Auth & data

1. Create a [Clerk](https://dashboard.clerk.com) application (Next.js). To grant staff access, set a user's `publicMetadata.role` to `admin` or `manager` in the Clerk dashboard — self-serve sign-up always defaults to `customer`.
2. Create a [Supabase](https://supabase.com/dashboard) project; run, in order: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/supplier-pricing-research.sql`.
3. Create a [Stripe](https://dashboard.stripe.com) account (test mode is fine for now). Grab the secret key from API keys, and create a webhook endpoint pointing at `<your-deployment>/api/checkout/webhook` for the `checkout.session.completed` event to get the webhook signing secret. Locally, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe listen --forward-to localhost:8084/api/checkout/webhook`) instead of a dashboard webhook.
4. Create a [Resend](https://resend.com) account for the managed-client notification emails. `RESEND_FROM_EMAIL` needs a domain verified in Resend to reach real inboxes — leave it unset to fall back to their `onboarding@resend.dev` sandbox address (only deliverable to the Resend account's own verified email, fine for early testing).
5. Copy `.env.example` → `.env.local` and fill keys (also add the same to Vercel → Settings → Environment Variables).
6. `npm run dev` — homepage/cart stay public; `/account` and `/admin` require sign-in (`/admin` also requires the staff role); checkout requires Stripe keys to be set; notification emails require Resend keys to be set.

## Next slices

Still open on the build list: import existing clients, set up an internal testing plan, add prices to imported products, Trends catalogue change monitoring, and the go-live steps under "Handover". See the status table at the top.

Build order pivoted 2026-09-18 to the managed-client PO path (Xero-billed) ahead of Stripe — see `build-brief.md` "Immediate priority":

1. ~~Data model: clients (type, account manager, credit terms), sub-orders, order lifecycle status~~ — `supabase/clients-and-po.sql`, `src/lib/types.ts`
2. ~~Managed client PO flow: account manager creates an order on behalf of a managed client~~ — `/admin/clients`, `/admin/orders/new`
3. ~~Admin / account-manager order visibility: status overview + Kanban board~~ — `/admin/orders`
4. ~~Notification milestones, scoped to managed clients first~~ — `src/lib/notifications.ts`, needs `RESEND_API_KEY` to test end-to-end
5. Xero push: order detail sent to Xero once a job is ready to invoice — built 2026-09-24, not yet connected. Run `supabase/xero.sql`, set `XERO_CLIENT_ID`/`XERO_CLIENT_SECRET` in Vercel (from a Xero "Web app" at developer.xero.com, redirect URI `https://<domain>/api/xero/callback`, free Starter tier is enough for one organisation), then an admin in BrandSource's Xero clicks **Connect to Xero** at `/admin/xero`. Completed PO orders get a **Send to Xero** button on `/admin/orders`: finds or creates the Xero contact by client name, creates a sales invoice (reference = PO number, due date = credit terms), marks the order `invoiced`. Optional env: `XERO_SALES_ACCOUNT_CODE` (default `200`), `XERO_LINE_AMOUNT_TYPES` (`Inclusive` default, i.e. catalog prices include GST; or `Exclusive`), `XERO_INVOICE_STATUS` (`DRAFT` default so staff review in Xero before it's sent; or `AUTHORISED`). Uses Xero's granular scopes (`accounting.invoices`, `accounting.contacts`), which apps created after 2 March 2026 require.
6. ~~Admin CSV reporting: by customer, by item, by price~~ — done 2026-09-23: `/admin/orders/export?report=transactions|customer|item|price`, linked from `/admin/orders` (staff-only, drafts excluded)

Stripe/direct-consumer checkout is built and paused (needs `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to test end-to-end) — picked back up once the managed-client path is live.

## SKUs (original 7 pilot products)

Five of these were deleted on 2 Oct and Table Covers and Feather Flags deactivated; the live catalogue is now the Trends import. Kept for history.

| Slug | Product |
| --- | --- |
| `table-covers` | Custom rectangle table covers |
| `led-lightbox-bannerstand` | LED lightbox bannerstand |
| `feather-teardrop-flags` | Feather & teardrop flags |
| `banner-stands` | Banner stands |
| `lanyards` | Full-colour sublimation lanyards |
| `custom-buttons` | Custom buttons (MOQ 50) |
| `led-lightbox-counter` | LED lightbox counter |
