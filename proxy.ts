import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ADMIN_EMAILS,
  SUPABASE_ANON_KEY,
  SUPABASE_HOSTNAME,
  SUPABASE_URL,
} from "@/lib/env";
import { buildCsp } from "@/lib/csp";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin only (see matcher). CSP nonce, regenerated each request. Forwarded
  // to RSC via request header and emitted as the response CSP. The admin
  // layout reads it via headers() and threads it onto inline scripts so
  // they survive strict-dynamic. The storefront gets a static CSP from
  // next.config.ts so its pages can be cached.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp({
    nonce,
    supabaseOrigin: SUPABASE_HOSTNAME
      ? `https://${SUPABASE_HOSTNAME}`
      : "https://*.supabase.co",
    isDev: process.env.NODE_ENV !== "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Belt-and-suspenders on top of robots.txt: stamp the response header so
  // any crawler (compliant or not) that fetches an admin page is told
  // never to index or follow. /checkout gets the same from next.config.ts.
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (pathname === "/admin/login") return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Admin only. The proxy runs as a function on every matched request,
  // so keeping storefront paths out saves an invocation per page view and
  // lets cached pages be served straight from the CDN.
  matcher: ["/admin", "/admin/:path*"],
};
