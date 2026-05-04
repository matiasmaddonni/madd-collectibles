import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export const EMAIL_FROM =
  process.env.RESEND_FROM || "MADD <onboarding@resend.dev>";
export const EMAIL_TO =
  process.env.CHECKOUT_NOTIFY_EMAIL || "matiasmaddonni.dev@gmail.com";
