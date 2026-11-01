/**
 * Shared BRANDSource email shell: charcoal header band with the reversed
 * wordmark, white body, light-grey footer. Every customer email renders its
 * content through this so the brand only lives in one place.
 *
 * Rules from brand-assets/brand-spec.md:
 * - Orange (#FF4B00) is the only accent. Never orange text on white (3.4:1);
 *   orange is for buttons (bold, 19px) and for text on charcoal (4.9:1).
 * - Square corners, bold uppercase button labels with a trailing arrow.
 * - Email clients mostly don't render SVG, so the logo is a small PNG.
 */

export const EMAIL_COLOURS = {
  charcoal: "#1B2024",
  orange: "#FF4B00",
  white: "#FFFFFF",
  grey: "#F4F4F2",
  midGrey: "#5B6166",
  rule: "#E3E3E0",
} as const;

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatNzd(amount: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://brandsource.co.nz").replace(/\/$/, "");
}

/** Bulletproof button: a table cell so the orange fill survives Outlook. */
export function emailButton(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${EMAIL_COLOURS.orange}" style="background:${EMAIL_COLOURS.orange};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;font-family:${FONT};font-size:19px;line-height:24px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${EMAIL_COLOURS.white};text-decoration:none;">${escapeHtml(label)}&nbsp;&rarr;</a>
    </td>
  </tr></table>`;
}

export type EmailLayoutInput = {
  /** Hidden inbox preview line. */
  preheader: string;
  /** Small uppercase label above the headline, e.g. "Order confirmed". */
  eyebrow: string;
  /** Headline words before the highlighted word. */
  headlineStart: string;
  /** The single word shown in orange. */
  headlineAccent: string;
  /** Headline words after the highlighted word (optional). */
  headlineEnd?: string;
  /** Inner HTML for the white body. */
  bodyHtml: string;
};

export function renderEmailLayout(input: EmailLayoutInput) {
  const c = EMAIL_COLOURS;
  const logo = `${siteUrl()}/brand/email/BrandSource-Reversed-email.png`;
  const headline = [
    escapeHtml(input.headlineStart),
    `<span style="color:${c.orange};">${escapeHtml(input.headlineAccent)}</span>`,
    input.headlineEnd ? escapeHtml(input.headlineEnd) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.eyebrow)} | BRANDSource</title>
</head>
<body style="margin:0;padding:0;background:${c.grey};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.grey}" style="background:${c.grey};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td bgcolor="${c.charcoal}" style="background:${c.charcoal};padding:32px 32px 36px 32px;">
      <img src="${logo}" width="240" alt="BRANDSource" style="display:block;border:0;width:240px;height:auto;">
      <p style="margin:32px 0 8px 0;font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.white};">${escapeHtml(input.eyebrow)}</p>
      <h1 style="margin:0;font-family:${FONT};font-size:34px;line-height:38px;font-weight:900;letter-spacing:-0.01em;text-transform:uppercase;color:${c.white};">${headline}</h1>
    </td></tr>
    <tr><td height="6" bgcolor="${c.orange}" style="height:6px;line-height:6px;font-size:0;background:${c.orange};">&nbsp;</td></tr>
    <tr><td bgcolor="${c.white}" style="background:${c.white};padding:32px;font-family:${FONT};font-size:16px;line-height:24px;color:${c.charcoal};">
      ${input.bodyHtml}
    </td></tr>
    <tr><td bgcolor="${c.grey}" style="background:${c.grey};padding:24px 32px;font-family:${FONT};font-size:13px;line-height:20px;color:${c.midGrey};">
      <p style="margin:0 0 8px 0;"><strong style="color:${c.charcoal};">BRANDSource</strong></p>
      <p style="margin:0;">Questions about your order? Just reply to this email and a real person will get back to you.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
