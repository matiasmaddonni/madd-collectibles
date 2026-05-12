import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/env";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!isAdminEmail(user.email)) throw new Error("Forbidden");
  return user;
}
