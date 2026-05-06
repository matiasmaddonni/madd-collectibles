import "server-only";

const FALLBACK_RATE = Number(process.env.NEXT_PUBLIC_USD_TO_ARS) || 1300;

type DolarApiResponse = {
  venta?: number;
  compra?: number;
};

export async function getUsdToArsRate(): Promise<number> {
  const override = Number(process.env.NEXT_PUBLIC_USD_TO_ARS);
  if (Number.isFinite(override) && override > 0) return override;

  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK_RATE;
    const data = (await res.json()) as DolarApiResponse;
    const rate = data.venta ?? data.compra;
    return Number.isFinite(rate) && rate && rate > 0 ? rate : FALLBACK_RATE;
  } catch {
    return FALLBACK_RATE;
  }
}

export function convertUsdToArs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate);
}

export function convertArsToUsd(amountArs: number, rate: number): number {
  if (rate <= 0) return amountArs;
  return Math.round((amountArs / rate) * 100) / 100;
}
