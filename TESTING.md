# BrandSource testing plan

For Lloyd, Joe and Joe's team. Plain English, no code needed. Work through a scenario, tick it off, and add anything odd to "Inbox" in [`JOE-TODO.md`](JOE-TODO.md).

**Status:** started 5 Oct 2026. Scenarios 1 to 3 are written (PO order to Xero, card purchase, account manager progression). Order emails are covered inside Scenario 3. Staff roles, categories, hero images and mobile still need their own scenarios.

**Use a test client for anything that reaches Xero.** Draft invoices and any new contacts land in BrandSource's real Xero. Delete test drafts in Xero afterwards.

---

## Scenario 1: Purchase-order order to a Xero draft invoice

**Who:** one account manager (Joe's team) and one person with Xero access (Joe or Lloyd).
**Where:** the staging site, signed in with a staff account. Any laptop browser is fine.
**Why:** this is the core job for managed clients. Account managers pick an existing client, raise an order on their behalf, and a draft invoice goes to Xero. Xero holds each customer's payment terms.

### A. Happy path

1. Go to **Staff > New order** (`/admin/orders/new`).
2. Type a few letters of an existing client's name in the client box. The list should narrow as you type. Pick a client.
3. Add one or two product lines and enter a PO number.
4. Submit. The order should appear on the staff board (`/admin`) as **New**, and on **Orders** (`/admin/orders`) with the client, PO number and total.
5. On **Orders** (`/admin/orders`), click **Send to Xero** on that order. It can be sent at any stage, so payment can start while the order is being made.
6. Move the order through production on the board until it is **Completed**. Its status should keep updating after the invoice is sent.
7. In Xero, open the draft invoice and check it.

**Pass when:**
- [ ] The client appeared in the picker and matched what you typed.
- [ ] The order shows on the board and in Orders with the right client, PO number and total.
- [ ] After Send to Xero the order shows an **Invoiced** badge with the Xero invoice number, the button is gone, and its production status still moves on as normal.
- [ ] In Xero it is a **draft** invoice on the **existing** contact for that client (no new contact created).
- [ ] The PO number appears as the invoice reference, and the lines and amounts match the order.
- [ ] The due date follows **that contact's payment terms in Xero** (BrandSource does not set it).
- [ ] The account code and GST treatment are what the accountant expects.

### B. Name does not match Xero (important)

Client names must match the Xero contact name **exactly**. Test what happens when they don't.

1. At **Staff > Clients** (`/admin/clients`), add a client with a deliberately wrong name, for example an existing Xero customer with one letter changed.
2. Raise and complete a PO order for it, then Send to Xero.

**Expected:** Xero creates a **new** contact with that name and no payment terms, so the invoice takes the organisation default terms. Record what you see. This is the failure to watch for in real use.
- [ ] Result recorded. Delete the stray contact and draft invoice in Xero afterwards.

### C. Client with no account manager or email

1. Pick an imported client (none have an account manager or contact email yet) and raise an order.

**Pass when:**
- [ ] The order is created without errors.
- [ ] Nobody gets an "order received" email, and nothing breaks because of it.

### D. Guard rails

- [ ] A draft order has no Send to Xero button.
- [ ] A sent order cannot be sent again (no duplicate invoice in Xero).
- [ ] A signed-out user, or a customer account, cannot open `/admin/orders/new`.

### Notes to record

- Who tested, device and browser, date.
- Anything confusing in the wording or layout, even if it technically worked.

---

## Scenario 2: Customer buys on the website with a card (Stripe)

**Who:** anyone, ideally a person who has not used the site before, plus a staff member to check the other side.
**Where:** the staging site on a laptop. Repeat once on a phone.
**Why:** this is the direct-customer path. Stripe is in **test mode**, so no real money moves.

**Test card:** use Stripe's published test card `4242 4242 4242 4242`, any future expiry date and any 3 digit security code. Never use a real card on staging.

### A. Happy path

1. Browse to a category, open a product, choose options and a quantity, and add it to the cart.
2. In the cart, upload an artwork file against the item.
3. Check out. Sign in or sign up when asked.
4. On the Stripe page, pay with the test card.
5. You should land back on the site after payment.
6. As staff, open the staff board (`/admin`) and Orders (`/admin/orders`).

**Pass when:**
- [ ] The price in the cart matches the product page, and the total is right.
- [ ] The artwork upload worked and shows against the item.
- [ ] Payment went through and the customer was sent back to the site.
- [ ] The order appears in Orders (`/admin/orders`) with the customer name, paid by card and the right total.
- [ ] On the staff board each item shows as **Payment received**, with the artwork count and the customer.
- [ ] The customer's account page (`/account`) shows the order and its stage.

### B. Things that should not happen

- [ ] Close the Stripe page without paying. No order should show in Orders or on the board (unpaid checkouts stay hidden).
- [ ] Pay with Stripe's declined test card `4000 0000 0000 0002`. The customer sees the failure on Stripe's page and no order appears.
- [ ] An order does not appear twice if you refresh the return page.

### C. Notes

- Order emails are only built for managed (PO) clients so far. A card customer **not** receiving emails is expected, not a bug.
- Repeat A on a phone and note anything hard to tap or read.

---

## Scenario 3: Account manager order progression

**Who:** an account manager (Joe's team), plus one person watching the order from the outside (a client contact, or a test email address).
**Where:** the staff board (`/admin`) and Orders (`/admin/orders`), signed in with a staff account.
**Why:** this is the daily work: taking an order from new to completed and keeping the client informed. It carries on from Scenario 1 (PO order) and Scenario 2 (card order), so run it on an order from either.

**Careful with emails:** the imported clients have no contact email, so no emails go out. To test the emails, add a contact email to a **test client only** (your own address, at `/admin/clients`). Never add a test email to a real client's record, and never move a real client's order through stages as a test.

### A. Moving an order along the board

1. Open the staff board (`/admin`). Find the order's items. Each item is a card in a column.
2. Click to claim an item as yours. Your name should show on it.
3. Tick the progress boxes on the card in order: **Payment received, Artwork received, Proof approved, Ordered from supplier, In production, Dispatched**. The first tick moves a New order card to **Processing** by itself. When the job is delivered, move the card to **Completed** with the column dropdown (card orders arrive in New order with Payment received already ticked).
4. After each move, check Orders (`/admin/orders`) for the order-level status.

**Pass when:**
- [ ] The ticks and the "N of 6" count stay after a page refresh, and the card moves to Processing on the first tick.
- [ ] Moving to Completed only happens when you choose it, even with all six ticked.
- [ ] Claiming shows the right staff name, and it can be removed again.
- [ ] The order shows **New** until an item has "Ordered from supplier" (or In production / Dispatched) ticked, then **In production**, then **Completed** once every item is Completed.
- [ ] With **two items** in one order, the order stays **In production** until both are Completed, not just one.
- [ ] The artwork attached by the customer can be opened from the card.
- [ ] A signed-out user or a customer account cannot open the board or change a status.

### B. Client emails (PO orders only, test client with your email)

- [ ] **Order received** arrives when the order is raised.
- [ ] **Manufacturing begun** arrives when the order first goes In production.
- [ ] **Manufacturing finished** arrives when every item is Dispatched or Completed.
- [ ] **Delivery completed** arrives when every item is Completed.
- [ ] Each email arrives **once**. Moving an item back and forward does not send repeats.
- [ ] If the client has an account manager set, they are copied on "Order received".
- [ ] The wording is something Joe would be happy for a client to read.

Emails also need Joe's domain verified with Resend. Until then they may not arrive, which is a known blocker rather than a failed test.

### C. Handing on to invoicing

- [ ] Once a PO order is **Completed**, Send to Xero appears (see Scenario 1).
- [ ] After sending, the order shows **Invoiced** and moving items on the board does not change it back.

### D. Notes

- Is it clear which items still need action? Is anything missing from a card that you needed?
- Is the order of stages right for how the team really works? Say so if a stage should be added, renamed or skipped.

---

## Still to write

- Staff and customer sign-in and roles
- Category assignment and the product pages
- Hero images
- Mobile
