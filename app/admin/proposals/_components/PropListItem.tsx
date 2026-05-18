"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatRelative } from "../../products/_components/relativeTime";

type Props = {
  productId: string;
  name: string;
  lineName: string | null;
  status: "new" | "in_review";
  fieldCount: number;
  imageCount: number;
  sources: string[];
  confidence: number;
  fetchedAt: string;
};

function confTier(c: number): "high" | "med" | "low" {
  if (c >= 90) return "high";
  if (c >= 70) return "med";
  return "low";
}

export function PropListItem({
  productId,
  name,
  lineName,
  status,
  fieldCount,
  imageCount,
  sources,
  confidence,
  fetchedAt,
}: Props) {
  const sp = useSearchParams();
  const activeId = sp.get("id");
  const active = activeId === productId;
  const tier = confTier(confidence);
  const next = new URLSearchParams(sp.toString());
  next.set("id", productId);
  return (
    <Link
      href={`/admin/proposals?${next.toString()}`}
      className={`ah-prop-item${active ? " is-active" : ""}`}
    >
      <div className="ah-prop-item-top">
        <span className="ah-prop-item-name">{name}</span>
        {status === "new" && <span className="ah-tag ah-tag--new">NEW</span>}
      </div>
      <div className="ah-prop-item-mid">{lineName ?? "—"}</div>
      <div className="ah-prop-item-bot">
        <span>
          {fieldCount} fields · {imageCount} images
        </span>
        <span>{formatRelative(fetchedAt)}</span>
      </div>
      <div className="ah-prop-item-foot">
        <span className="ah-prop-sources">
          {sources.map((s) => (
            <span key={s} className="ah-source-pill">
              {s}
            </span>
          ))}
        </span>
        <span className={`ah-conf ah-conf--${tier}`}>
          <span className="ah-conf-track">
            <span
              className="ah-conf-fill"
              style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
            />
          </span>
          <span className="ah-conf-label">{confidence}%</span>
        </span>
      </div>
    </Link>
  );
}
