import { signOut } from "../actions";
import { NavLink } from "./NavLink";
import { SettingsDropdown } from "./SettingsDropdown";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  pendingProposals: number;
  taxonomyCounts: { brands: number; lines: number; series: number };
  userEmail: string;
};

export function ShellHeader({ pendingProposals, taxonomyCounts, userEmail }: Props) {
  return (
    <header className="ah-header">
      <div className="ah-brand">
        <span className="ah-brand-word">MADD</span>
        <span className="ah-brand-dot">.</span>
        <span className="ah-brand-tag">admin</span>
      </div>

      <nav className="ah-nav">
        <NavLink href="/admin" label="Dashboard" exact />
        <NavLink href="/admin/products" label="Products" />
        <NavLink href="/admin/proposals" label="Proposals" badge={pendingProposals} />
        <SettingsDropdown counts={taxonomyCounts} />
      </nav>

      <div className="ah-header-right">
        <ThemeToggle />
        <span className="ah-user">{userEmail}</span>
        <form action={signOut}>
          <button type="submit" className="ah-btn ah-btn--ghost">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
