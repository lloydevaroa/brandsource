import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend() {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing RESEND_API_KEY");
  }
  resend = new Resend(key);
  return resend;
}
