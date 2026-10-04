# BrandSource testing plan

For Lloyd, Joe and Joe's team. Plain English, no code needed. Work through a scenario, tick it off, and add anything odd to "Inbox" in [`JOE-TODO.md`](JOE-TODO.md).

**Status:** started 5 Oct 2026. Scenario 1 is written. The other areas (card checkout, order emails, staff roles, categories, hero images, mobile) still need scenarios.

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
5. Move the order through production on the board until it is **Completed**.
6. On **Orders** (`/admin/orders`), click **Send to Xero** on that order.
7. In Xero, open the draft invoice and check it.

**Pass when:**
- [ ] The client appeared in the picker and matched what you typed.
- [ ] The order shows on the board and in Orders with the right client, PO number and total.
- [ ] After Send to Xero the order shows as **Invoiced** with a Xero invoice number, and the button is gone.
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

- [ ] An order that is not yet **Completed** has no Send to Xero button.
- [ ] A sent order cannot be sent again (no duplicate invoice in Xero).
- [ ] A signed-out user, or a customer account, cannot open `/admin/orders/new`.

### Notes to record

- Who tested, device and browser, date.
- Anything confusing in the wording or layout, even if it technically worked.

---

## Still to write

- Card checkout (Stripe test mode)
- The four order emails (needs the Resend domain verified first)
- Staff and customer sign-in and roles
- Category assignment and the product pages
- Hero images
- Mobile
