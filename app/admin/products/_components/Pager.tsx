import Link from "next/link";

type Props = {
  page: number;
  pageCount: number;
  baseParams: URLSearchParams;
};

export function Pager({ page, pageCount, baseParams }: Props) {
  if (pageCount <= 1) return null;
  const buildHref = (p: number) => {
    const next = new URLSearchParams(baseParams.toString());
    if (p > 0) next.set("page", String(p));
    else next.delete("page");
    return `/admin/products?${next.toString()}`;
  };
  const prevDisabled = page <= 0;
  const nextDisabled = page >= pageCount - 1;
  return (
    <div className="ah-pager">
      {prevDisabled ? (
        <span className="ah-btn" style={{ opacity: 0.45, pointerEvents: "none" }}>
          ← Prev
        </span>
      ) : (
        <Link href={buildHref(page - 1)} className="ah-btn">
          ← Prev
        </Link>
      )}
      <span className="ah-pager-info">
        Page {page + 1} of {pageCount}
      </span>
      {nextDisabled ? (
        <span className="ah-btn" style={{ opacity: 0.45, pointerEvents: "none" }}>
          Next →
        </span>
      ) : (
        <Link href={buildHref(page + 1)} className="ah-btn">
          Next →
        </Link>
      )}
    </div>
  );
}
