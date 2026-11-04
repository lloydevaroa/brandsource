// Renders the customer emails with sample data to emails-preview/*.html for review.
// Run: npx tsx scripts/preview-emails.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderOrderConfirmation, sampleOrderConfirmation } from "../src/lib/emails/order-confirmation";
import { sampleMilestones } from "../src/lib/emails/milestones";

// The preview embeds the logo so the file is self-contained and can be sent for review.
process.env.NEXT_PUBLIC_SITE_URL ??= "https://preview.invalid";
const logo = readFileSync("public/brand/email/BrandSource-Reversed-email.png").toString("base64");

mkdirSync("emails-preview", { recursive: true });

const emails: Record<string, { subject: string; html: string; text: string }> = {
  "order-confirmation": renderOrderConfirmation(sampleOrderConfirmation()),
  ...sampleMilestones(),
};

for (const [name, email] of Object.entries(emails)) {
  writeFileSync(
    `emails-preview/${name}.html`,
    email.html.replace("https://preview.invalid/brand/email/BrandSource-Reversed-email.png", `data:image/png;base64,${logo}`)
  );
  writeFileSync(`emails-preview/${name}.txt`, `Subject: ${email.subject}\n\n${email.text}\n`);
}
console.log(`Wrote ${Object.keys(emails).length} emails to emails-preview/ (.html and .txt)`);
