import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAILS } from "@/lib/env";
import { ShellHeader } from "./_components/ShellHeader";
import { ThemeBootstrap } from "./_components/ThemeBootstrap";
import "./admin.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Defense in depth: proxy.ts already redirects non-admins to /admin/login,
  // but if the proxy matcher ever regresses or is bypassed, this layout must
  // not render the shell + service-role data for an unauthorised viewer.
  // Falls back to the bare wrapper (used by /admin/login itself).
  const isAdmin =
    !!user &&
    ADMIN_EMAILS.length > 0 &&
    ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

  if (!user || !isAdmin) {
    return (
      <div id="admin-root" className="admin-root" suppressHydrationWarning>
        <ThemeBootstrap nonce={nonce} />
        <main className="ah-main">{children}</main>
      </div>
    );
  }

  const admin = createAdminClient();
  const [propRes, imgRes, brandsRes, linesRes, seriesRes] = await Promise.all([
    admin.from("crawl_proposals").select("product_id").eq("status", "pending"),
    admin
      .from("product_images")
      .select("product_id")
      .not("proposed_by_source", "is", null),
    admin.from("brands").select("id", { count: "exact", head: true }),
    admin.from("product_lines").select("id", { count: "exact", head: true }),
    admin.from("series").select("id", { count: "exact", head: true }),
  ]);

  // Count distinct product_ids with pending review work (field proposals OR
  // crawler-uploaded images). Matches the list view's grouped-by-product cards.
  const productIds = new Set<string>();
  for (const r of (propRes.data ?? []) as Array<{ product_id: string }>) {
    productIds.add(r.product_id);
  }
  for (const r of (imgRes.data ?? []) as Array<{ product_id: string }>) {
    productIds.add(r.product_id);
  }
  const pendingProposals = productIds.size;

  const taxonomyCounts = {
    brands: brandsRes.count ?? 0,
    lines: linesRes.count ?? 0,
    series: seriesRes.count ?? 0,
  };

  return (
    <div id="admin-root" className="admin-root" suppressHydrationWarning>
      <ThemeBootstrap nonce={nonce} />
      <ShellHeader
        pendingProposals={pendingProposals}
        taxonomyCounts={taxonomyCounts}
        userEmail={user.email ?? ""}
      />
      <main className="ah-main">{children}</main>
    </div>
  );
}
