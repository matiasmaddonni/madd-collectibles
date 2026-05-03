export function formatPrice(price: number, currency: string): string {
  switch (currency) {
    case 'USD':
      return `$${price.toLocaleString('en-US')} USD`
    case 'ARS':
      return `$${price.toLocaleString('es-AR')} ARS`
    default:
      return String(price)
  }
}

export function formatPriceShort(price: number, currency: string): string {
  switch (currency) {
    case 'USD':
      return `$${price.toLocaleString('en-US')}`
    case 'ARS':
      return price >= 1000
        ? `$${Math.round(price / 1000)}k`
        : `$${price.toLocaleString('es-AR')}`
    default:
      return String(price)
  }
}
