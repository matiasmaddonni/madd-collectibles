export type SupportedCurrency = "ARS" | "USD";

// Both currencies display as whole units. USD is ceiled (99.99 → 100) so the
// rendered figure is never less than what the buyer owes — avoids the
// rounded-down-to-99 surprise at checkout.
export function formatPrice(amount: number, currency: SupportedCurrency) {
  const value = currency === "USD" ? Math.ceil(amount) : amount;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
