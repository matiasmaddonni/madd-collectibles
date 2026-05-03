export type SupportedCurrency = "ARS" | "USD";

export function formatPrice(amount: number, currency: SupportedCurrency) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
