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

// CHECKOUT_NOTIFY_EMAIL must be set in prod — refuses to ship without it.
// getResend() returns null when RESEND_API_KEY is unset, which short-
// circuits all email sends before EMAIL_TO is read, so dev / preview can
// run without the env var. In prod (where Resend IS configured) we want
// to fail loudly if the destination is missing rather than silently mail
// a stale fallback address.
export const EMAIL_TO = (() => {
  const value = process.env.CHECKOUT_NOTIFY_EMAIL;
  if (value && value.length > 0) return value;
  if (process.env.RESEND_API_KEY)
    throw new Error("CHECKOUT_NOTIFY_EMAIL is required when RESEND_API_KEY is set");
  return "";
})();
