const required = (key: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const optional = (value: string | undefined): string | null =>
  value && value.length > 0 ? value : null;

export const SITE_URL =
  optional(process.env.NEXT_PUBLIC_SITE_URL) ??
  "https://madd-collectibles.vercel.app";

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const META_PIXEL_ID = optional(process.env.NEXT_PUBLIC_META_PIXEL_ID);

export const WA_NUMBER = optional(process.env.NEXT_PUBLIC_WA_NUMBER);

export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const SUPABASE_HOSTNAME = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return "";
  }
})();
