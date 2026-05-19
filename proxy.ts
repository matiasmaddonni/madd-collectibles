import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ADMIN_EMAILS,
  SUPABASE_ANON_KEY,
  SUPABASE_HOSTNAME,
  SUPABASE_URL,
} from "@/lib/env";

function buildCsp(nonce: string): string {
  const supabaseOrigin = SUPABASE_HOSTNAME
    ? `https://${SUPABASE_HOSTNAME}`
    : "https://*.supabase.co";
  const isDev = process.env.NODE_ENV !== "production";
  // React's dev runtime + Next's Turbopack HMR both require eval() in
  // development — production never does. In prod we keep CSP strict.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https:",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${supabaseOrigin} https://www.facebook.com`,
    `connect-src 'self' ${supabaseOrigin} https://api.exchangerate.host https://dolarapi.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://www.facebook.com${isDev ? " ws: http://localhost:*" : ""}`,
    "frame-src 'self'",
    "form-action 'self' https://api.whatsapp.com https://wa.me",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSP nonce — regenerated each request. Forwarded to RSC via request header
  // and emitted as the response CSP. Layout reads it via headers() and threads
  // it onto inline <Script nonce={…}> tags so they survive strict-dynamic.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Belt-and-suspenders on top of robots.txt: stamp the response header so
  // any crawler (compliant or not) that fetches an admin / checkout page
  // is told never to index or follow.
  if (pathname.startsWith("/admin") || pathname.startsWith("/checkout")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  if (!pathname.startsWith("/admin")) return response;
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
  // Run on every page request so CSP nonce is present everywhere, but skip
  // static assets, image optimizer, and favicon for performance.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|txt|xml|json)$).*)",
  ],
};
