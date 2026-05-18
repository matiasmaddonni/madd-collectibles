export type ProductStatus = "draft" | "available" | "reserved" | "sold";

export function StatusChip({ status }: { status: ProductStatus }) {
  return <span className={`ah-chip ah-chip--${status}`}>{status}</span>;
}
