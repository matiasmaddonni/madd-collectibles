"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  label: string;
  exact?: boolean;
  badge?: number;
};

export function NavLink({ href, label, exact = false, badge }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={`ah-nav-item${active ? " is-active" : ""}`}>
      {label}
      {badge && badge > 0 ? <span className="ah-nav-badge">{badge}</span> : null}
    </Link>
  );
}
