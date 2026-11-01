import {
  EMAIL_COLOURS,
  emailButton,
  escapeHtml,
  formatNzd,
  renderEmailLayout,
  siteUrl,
} from "./layout";

export type OrderConfirmationLine = {
  name: string;
  /** "Group: choice · Group: choice", from configurationSummary(). */
  summary: string;
  quantity: number;
  unitPrice: number;
};

export type OrderConfirmationData = {
  customerName: string;
  /** Short reference shown to the customer. */
  orderNumber: string;
  orderDate: string;
  lines: OrderConfirmationLine[];
  total: number;
  /** True when any line has no artwork uploaded yet. */
  needsArtwork: boolean;
  orderUrl: string;
};

export function orderReference(orderId: string) {
  return `BS-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || "there";
}

export function renderOrderConfirmation(data: OrderConfirmationData) {
  const c = EMAIL_COLOURS;
  const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
  const name = escapeHtml(firstName(data.customerName));

  const rows = data.lines
    .map(
      (line) => `<tr>
        <td style="padding:16px 0;border-bottom:1px solid ${c.rule};font-family:${font};font-size:16px;line-height:22px;color:${c.charcoal};">
          <strong>${escapeHtml(line.name)}</strong>
          ${line.summary ? `<br><span style="font-size:14px;line-height:20px;color:${c.midGrey};">${escapeHtml(line.summary)}</span>` : ""}
          <br><span style="font-size:14px;line-height:20px;color:${c.midGrey};">Qty ${line.quantity} &times; ${formatNzd(line.unitPrice)}</span>
        </td>
        <td align="right" valign="top" style="padding:16px 0;border-bottom:1px solid ${c.rule};font-family:${font};font-size:16px;line-height:22px;font-weight:700;color:${c.charcoal};white-space:nowrap;">${formatNzd(line.quantity * line.unitPrice)}</td>
      </tr>`
    )
    .join("");

  const steps = [
    data.needsArtwork
      ? ["Send us your artwork", "Upload your files from your order page. We can't start until we have them."]
      : ["We check your artwork", "Our team looks over your files to make sure they're ready to print."],
    ["Approve your proof", "We email you a proof. Nothing is made until you say yes."],
    ["We make and deliver it", "Once the proof is approved your order goes into production. We'll email you at each step."],
  ];

  const stepsHtml = steps
    .map(
      ([title, text], i) => `<tr>
        <td width="40" valign="top" style="padding:0 0 16px 0;font-family:${font};font-size:28px;line-height:28px;font-weight:900;color:${c.charcoal};">${i + 1}</td>
        <td valign="top" style="padding:0 0 16px 0;font-family:${font};font-size:16px;line-height:22px;color:${c.charcoal};">
          <strong>${escapeHtml(title)}</strong><br><span style="color:${c.midGrey};">${escapeHtml(text)}</span>
        </td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${name},</p>
    <p style="margin:0 0 24px 0;">Thanks for your order. We've received your payment and it's now with our team.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="font-family:${font};font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.midGrey};">Order ${escapeHtml(data.orderNumber)}</td>
        <td align="right" style="font-family:${font};font-size:13px;line-height:18px;color:${c.midGrey};">${escapeHtml(data.orderDate)}</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid ${c.charcoal};">
      ${rows}
      <tr>
        <td style="padding:16px 0 0 0;font-family:${font};font-size:16px;line-height:22px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:${c.charcoal};">Total paid</td>
        <td align="right" style="padding:16px 0 0 0;font-family:${font};font-size:20px;line-height:22px;font-weight:800;color:${c.charcoal};white-space:nowrap;">${formatNzd(data.total)}</td>
      </tr>
    </table>

    <p style="margin:40px 0 16px 0;font-family:${font};font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.midGrey};">What happens next</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepsHtml}</table>

    <div style="margin:16px 0 0 0;">${emailButton(data.needsArtwork ? "Upload artwork" : "View your order", data.orderUrl)}</div>
  `;

  const html = renderEmailLayout({
    preheader: `We've got your order ${data.orderNumber}. Here's what happens next.`,
    eyebrow: "Order confirmed",
    // The eyebrow already says "Order confirmed", so the headline is the next action.
    ...(data.needsArtwork
      ? { headlineStart: "Now send us your", headlineAccent: "artwork" }
      : { headlineStart: "Next, look out for your", headlineAccent: "proof" }),
    bodyHtml,
  });

  const text = [
    `Hi ${firstName(data.customerName)},`,
    "",
    "Thanks for your order. We've received your payment and it's now with our team.",
    "",
    `Order ${data.orderNumber} (${data.orderDate})`,
    ...data.lines.flatMap((l) => [
      `- ${l.name}${l.summary ? ` (${l.summary})` : ""}`,
      `  Qty ${l.quantity} x ${formatNzd(l.unitPrice)} = ${formatNzd(l.quantity * l.unitPrice)}`,
    ]),
    `Total paid: ${formatNzd(data.total)}`,
    "",
    "What happens next",
    ...steps.map(([title, body], i) => `${i + 1}. ${title}: ${body}`),
    "",
    `${data.needsArtwork ? "Upload your artwork" : "View your order"}: ${data.orderUrl}`,
    "",
    "Questions about your order? Just reply to this email.",
    "",
    "BRANDSource",
  ].join("\n");

  return {
    subject: `Your BRANDSource order ${data.orderNumber} is confirmed`,
    html,
    text,
  };
}

export function sampleOrderConfirmation(): OrderConfirmationData {
  return {
    customerName: "Sam Taylor",
    orderNumber: "BS-7F3A91C2",
    orderDate: "1 November 2026",
    lines: [
      {
        name: "Pull-up Banner (Premium)",
        summary: "Size: 850 x 2000 mm · Base: Standard · Carry bag: Included",
        quantity: 2,
        unitPrice: 189,
      },
      {
        name: "Tablecloth, Fitted",
        summary: "Size: 6 ft · Print: Full colour, front and sides",
        quantity: 1,
        unitPrice: 245,
      },
    ],
    total: 623,
    needsArtwork: true,
    orderUrl: `${siteUrl()}/account`,
  };
}
