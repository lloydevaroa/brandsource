import { EMAIL_COLOURS, emailButton, escapeHtml, renderEmailLayout } from "./layout";

export type ArtworkReminderData = {
  customerName: string;
  /** Short reference shown to the customer, e.g. BS-519EFCAD. */
  orderNumber: string;
  /** Only the products that still have no artwork. */
  items: { name: string; summary: string; quantity: number }[];
  /** The customer's order page, where they upload against each product. */
  orderUrl: string;
  /** Site address used for the logo. */
  baseUrl?: string;
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || "there";
}

/** The chase email: tells the customer which products still need artwork and links to the upload page. */
export function renderArtworkReminder(data: ArtworkReminderData) {
  const c = EMAIL_COLOURS;
  const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
  const many = data.items.length !== 1;

  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:16px 0;border-bottom:1px solid ${c.rule};font-family:${font};font-size:16px;line-height:22px;color:${c.charcoal};">
          <strong>${escapeHtml(item.name)}</strong>
          ${item.summary ? `<br><span style="font-size:14px;line-height:20px;color:${c.midGrey};">${escapeHtml(item.summary)}</span>` : ""}
          <br><span style="font-size:14px;line-height:20px;color:${c.midGrey};">Qty ${item.quantity}</span>
        </td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName(data.customerName))},</p>
    <p style="margin:0 0 24px 0;">We can't start on your order ${escapeHtml(data.orderNumber)} until we have the artwork for ${many ? "these products" : "this product"}:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid ${c.charcoal};margin:0 0 24px 0;">
      ${rows}
    </table>
    <p style="margin:0 0 24px 0;">Sign in with the same login you used to place the order, then upload your files against each product. We'll send you a proof to approve before anything is made.</p>
    <div style="margin:0 0 24px 0;">${emailButton("Upload artwork", data.orderUrl)}</div>
    <p style="margin:0;font-size:14px;line-height:20px;color:${c.midGrey};">JPG, PNG, WebP, SVG, PDF, AI or EPS, up to 25MB each. No artwork yet? Reply to this email and we'll help.</p>
  `;

  const html = renderEmailLayout({
    preheader: `We still need artwork for ${many ? `${data.items.length} products` : "one product"} on order ${data.orderNumber}.`,
    eyebrow: `Order ${data.orderNumber}`,
    headlineStart: "We still need your",
    headlineAccent: "artwork",
    bodyHtml,
    baseUrl: data.baseUrl,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    `We can't start on your order ${data.orderNumber} until we have the artwork for ${many ? "these products" : "this product"}:`,
    ...data.items.map((i) => `- ${i.name}${i.summary ? ` (${i.summary})` : ""}, qty ${i.quantity}`),
    "",
    "Sign in with the same login you used to place the order, then upload your files against each product. We'll send you a proof to approve before anything is made.",
    "",
    `Upload artwork: ${data.orderUrl}`,
    "",
    "JPG, PNG, WebP, SVG, PDF, AI or EPS, up to 25MB each. No artwork yet? Reply to this email and we'll help.",
    "",
    "BRANDSource",
  ].join("\n");

  return {
    subject: `We still need your artwork for order ${data.orderNumber}`,
    html,
    text,
  };
}
