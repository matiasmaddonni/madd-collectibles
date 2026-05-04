export const WA_NUMBER =
  process.env.NEXT_PUBLIC_WA_NUMBER?.replace(/[^0-9]/g, "") || "5491100000000";

export function waLink(text?: string): string {
  const base = `https://wa.me/${WA_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
