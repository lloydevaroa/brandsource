import {
  EMAIL_COLOURS,
  emailButton,
  escapeHtml,
  renderEmailLayout,
  siteUrl,
} from "./layout";

/**
 * The order-progress emails a card-paying customer gets after the confirmation:
 * proof ready, in production, shipped, delivered, and a delay notice.
 * Each one says one thing and offers one button.
 */

export type MilestoneBase = {
  customerName: string;
  orderNumber: string;
  /** One short label per item, e.g. "2 x Pull-up Banner (Premium)". */
  itemLabels: string[];
  orderUrl: string;
};

export type ProofReadyData = MilestoneBase;
export type InProductionData = MilestoneBase & {
  /** Only shown when staff have a date to give. */
  estimatedDelivery?: string;
};
export type ShippedData = MilestoneBase & {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  deliveryAddress?: string;
};
export type DeliveredData = MilestoneBase;
export type DelayData = MilestoneBase & {
  delayedItem: string;
  newDate: string;
  /** Optional plain-language reason. */
  reason?: string;
};

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || "there";
}

function p(html: string, bottom = 16) {
  return `<p style="margin:0 0 ${bottom}px 0;">${html}</p>`;
}

function label(text: string) {
  const c = EMAIL_COLOURS;
  return `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.midGrey};">${escapeHtml(text)}</p>`;
}

/** Grey panel listing what the email is about, so every email carries the order reference. */
function orderPanel(data: MilestoneBase, extraRows: Array<[string, string]> = []) {
  const c = EMAIL_COLOURS;
  const items = data.itemLabels
    .map((item) => `<div style="padding:2px 0;">${escapeHtml(item)}</div>`)
    .join("");
  const extra = extraRows
    .map(
      ([k, v]) => `<tr>
        <td valign="top" style="padding:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.midGrey};white-space:nowrap;width:120px;">${escapeHtml(k)}</td>
        <td valign="top" style="padding:12px 0 0 0;font-family:${FONT};font-size:16px;line-height:22px;color:${c.charcoal};">${v}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.grey}" style="background:${c.grey};margin:8px 0 24px 0;">
    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" style="font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.midGrey};white-space:nowrap;width:120px;">Order</td>
          <td valign="top" style="font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;color:${c.charcoal};">${escapeHtml(data.orderNumber)}</td>
        </tr>
        <tr>
          <td valign="top" style="padding:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.midGrey};white-space:nowrap;">Items</td>
          <td valign="top" style="padding:12px 0 0 0;font-family:${FONT};font-size:16px;line-height:22px;color:${c.charcoal};">${items}</td>
        </tr>
        ${extra}
      </table>
    </td></tr>
  </table>`;
}

function textBlock(data: MilestoneBase, extraLines: string[] = []) {
  return [`Order ${data.orderNumber}`, ...data.itemLabels.map((i) => `- ${i}`), ...extraLines];
}

const SIGN_OFF = ["", "Questions about your order? Just reply to this email.", "", "BRANDSource"];

export function renderProofReady(data: ProofReadyData) {
  const bodyHtml = [
    p(`Hi ${escapeHtml(firstName(data.customerName))},`),
    p("Your proof is ready. This is how your order will look once it's made, so please check it carefully."),
    orderPanel(data),
    p("Look over the sizes, colours, spelling and positioning. Nothing is made until you approve it.", 24),
    `<div>${emailButton("Review your proof", data.orderUrl)}</div>`,
    `<p style="margin:24px 0 0 0;">Want something changed? Reply to this email with what you'd like different and we'll send a new proof.</p>`,
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `Your proof for order ${data.orderNumber} is ready. Nothing is made until you approve it.`,
    eyebrow: "Proof ready",
    headlineStart: "Please check every",
    headlineAccent: "detail",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    "Your proof is ready. This is how your order will look once it's made, so please check it carefully.",
    "",
    ...textBlock(data),
    "",
    "Look over the sizes, colours, spelling and positioning. Nothing is made until you approve it.",
    "",
    `Review your proof: ${data.orderUrl}`,
    "",
    "Want something changed? Reply to this email with what you'd like different and we'll send a new proof.",
    ...SIGN_OFF,
  ].join("\n");

  return { subject: `Your proof for order ${data.orderNumber} is ready to approve`, html, text };
}

export function renderInProduction(data: InProductionData) {
  const bodyHtml = [
    p(`Hi ${escapeHtml(firstName(data.customerName))},`),
    p("Thanks for approving your proof. Your order is now being made."),
    orderPanel(
      data,
      data.estimatedDelivery ? [["Expected", `<strong>${escapeHtml(data.estimatedDelivery)}</strong>`]] : []
    ),
    p("There's nothing you need to do. We'll email you again when it ships.", 24),
    `<div>${emailButton("View your order", data.orderUrl)}</div>`,
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `Order ${data.orderNumber} is now being made.`,
    eyebrow: "In production",
    headlineStart: "Your proof is",
    headlineAccent: "approved",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    "Thanks for approving your proof. Your order is now being made.",
    "",
    ...textBlock(data, data.estimatedDelivery ? [`Expected: ${data.estimatedDelivery}`] : []),
    "",
    "There's nothing you need to do. We'll email you again when it ships.",
    "",
    `View your order: ${data.orderUrl}`,
    ...SIGN_OFF,
  ].join("\n");

  return { subject: `Your BRANDSource order ${data.orderNumber} is being made`, html, text };
}

export function renderShipped(data: ShippedData) {
  const rows: Array<[string, string]> = [];
  if (data.carrier) rows.push(["Carrier", escapeHtml(data.carrier)]);
  if (data.trackingNumber) {
    rows.push([
      "Tracking",
      data.trackingUrl
        ? `<a href="${escapeHtml(data.trackingUrl)}" style="color:${EMAIL_COLOURS.charcoal};font-weight:700;">${escapeHtml(data.trackingNumber)}</a>`
        : `<strong>${escapeHtml(data.trackingNumber)}</strong>`,
    ]);
  }
  if (data.deliveryAddress) rows.push(["Sent to", escapeHtml(data.deliveryAddress)]);

  const bodyHtml = [
    p(`Hi ${escapeHtml(firstName(data.customerName))},`),
    p("Your order has been made and handed to the courier."),
    orderPanel(data, rows),
    p("Please check it over when it arrives. If anything isn't right, reply to this email and we'll sort it.", 24),
    `<div>${emailButton(data.trackingUrl ? "Track your delivery" : "View your order", data.trackingUrl ?? data.orderUrl)}</div>`,
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `Order ${data.orderNumber} has shipped.`,
    eyebrow: "Shipped",
    headlineStart: "Look out for your",
    headlineAccent: "delivery",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    "Your order has been made and handed to the courier.",
    "",
    ...textBlock(data, [
      ...(data.carrier ? [`Carrier: ${data.carrier}`] : []),
      ...(data.trackingNumber ? [`Tracking: ${data.trackingNumber}`] : []),
      ...(data.deliveryAddress ? [`Sent to: ${data.deliveryAddress}`] : []),
    ]),
    "",
    "Please check it over when it arrives. If anything isn't right, reply to this email and we'll sort it.",
    "",
    `${data.trackingUrl ? "Track your delivery" : "View your order"}: ${data.trackingUrl ?? data.orderUrl}`,
    ...SIGN_OFF,
  ].join("\n");

  return { subject: `Your BRANDSource order ${data.orderNumber} has shipped`, html, text };
}

export function renderDelivered(data: DeliveredData) {
  const bodyHtml = [
    p(`Hi ${escapeHtml(firstName(data.customerName))},`),
    p("Your order has been delivered. Thanks for choosing BRANDSource."),
    orderPanel(data),
    p("If anything isn't right, just reply to this email and a real person will sort it out.", 24),
    `<div>${emailButton("View your order", data.orderUrl)}</div>`,
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `Order ${data.orderNumber} has been delivered.`,
    eyebrow: "Delivered",
    headlineStart: "Enjoy your new",
    headlineAccent: "branding",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    "Your order has been delivered. Thanks for choosing BRANDSource.",
    "",
    ...textBlock(data),
    "",
    "If anything isn't right, just reply to this email and a real person will sort it out.",
    "",
    `View your order: ${data.orderUrl}`,
    ...SIGN_OFF,
  ].join("\n");

  return { subject: `Your BRANDSource order ${data.orderNumber} has been delivered`, html, text };
}

export function renderDelay(data: DelayData) {
  const bodyHtml = [
    p(`Hi ${escapeHtml(firstName(data.customerName))},`),
    p(
      `One item in your order is taking longer than we expected: <strong>${escapeHtml(data.delayedItem)}</strong>.${data.reason ? ` ${escapeHtml(data.reason)}` : ""}`
    ),
    orderPanel(data, [["New date", `<strong>${escapeHtml(data.newDate)}</strong>`]]),
    p("We're sorry for the wait. The rest of your order is unaffected. If the new date is a problem, reply to this email and we'll work out what we can do.", 24),
    `<div>${emailButton("View your order", data.orderUrl)}</div>`,
  ].join("\n");

  const html = renderEmailLayout({
    preheader: `An item in order ${data.orderNumber} is running late. New date: ${data.newDate}.`,
    eyebrow: "Order update",
    headlineStart: "One item is",
    headlineAccent: "running late",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    `One item in your order is taking longer than we expected: ${data.delayedItem}.${data.reason ? ` ${data.reason}` : ""}`,
    "",
    ...textBlock(data, [`New date: ${data.newDate}`]),
    "",
    "We're sorry for the wait. The rest of your order is unaffected. If the new date is a problem, reply to this email and we'll work out what we can do.",
    "",
    `View your order: ${data.orderUrl}`,
    ...SIGN_OFF,
  ].join("\n");

  return { subject: `An update on your BRANDSource order ${data.orderNumber}`, html, text };
}

const SAMPLE_BASE: MilestoneBase = {
  customerName: "Sam Taylor",
  orderNumber: "BS-7F3A91C2",
  itemLabels: ["2 x Pull-up Banner (Premium)", "1 x Tablecloth, Fitted"],
  orderUrl: `${siteUrl()}/account`,
};

export function sampleMilestones() {
  return {
    "proof-ready": renderProofReady(SAMPLE_BASE),
    "in-production": renderInProduction({ ...SAMPLE_BASE, estimatedDelivery: "Friday 20 November" }),
    shipped: renderShipped({
      ...SAMPLE_BASE,
      carrier: "NZ Couriers",
      trackingNumber: "NZC 4471 9920 3381",
      trackingUrl: "https://www.nzcouriers.co.nz/nzc/servlet/ITNG_TAndTServlet",
      deliveryAddress: "12 Example Street, Mt Eden, Auckland 1024",
    }),
    delivered: renderDelivered(SAMPLE_BASE),
    delay: renderDelay({
      ...SAMPLE_BASE,
      delayedItem: "Tablecloth, Fitted",
      newDate: "Friday 27 November",
      reason: "Our printer has pushed the print run back.",
    }),
  };
}
