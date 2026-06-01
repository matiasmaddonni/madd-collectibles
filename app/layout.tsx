import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, DM_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { Suspense } from "react";
import { Tracker } from "@/components/analytics/Tracker";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { META_PIXEL_ID, SITE_URL as ENV_SITE_URL } from "@/lib/env";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

const SITE_URL = ENV_SITE_URL;
const SITE_DESCRIPTION =
  "Figuras Tamashii Nations originales. Myth Cloth EX, S.H.Figuarts y más. De coleccionista a coleccionista.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MADD.",
    template: "%s | MADD.",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: "MADD.",
    url: SITE_URL,
    type: "website",
    locale: "es_AR",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
  },
};

const PIXEL_ID_RE = /^[0-9]{6,32}$/;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pixel ID only allowed if numeric — defends inline-script injection through
  // env misconfiguration. proxy.ts seeds a per-request nonce we thread here.
  const safePixelId =
    META_PIXEL_ID && PIXEL_ID_RE.test(META_PIXEL_ID) ? META_PIXEL_ID : null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="es-AR"
      className={`${bebas.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-deep text-text-primary font-body">
        {/*
          Organization structured data — site-wide brand SEO. Tells Google
          the canonical site name, logo, and social profiles so it can show
          a knowledge-panel-style sitelink and the right favicon.
        */}
        <script
          type="application/ld+json"
          nonce={nonce}
          // Browser strips the nonce attr off <script> tags after parsing for
          // security, so React sees a mismatch on hydration. Behaviour-correct,
          // warning is noise. Same suppression used in admin ThemeBootstrap.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "MADD.",
              alternateName: "MADD Collectibles",
              url: SITE_URL,
              logo: `${SITE_URL}/madd-logo.svg`,
              description: SITE_DESCRIPTION,
              areaServed: { "@type": "Country", name: "Argentina" },
            }),
          }}
        />
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
        <Analytics />
        <Suspense fallback={null}>
          <Tracker />
        </Suspense>
        {safePixelId && (
          <>
            <Script
              id="meta-pixel"
              strategy="afterInteractive"
              nonce={nonce}
              dangerouslySetInnerHTML={{
                __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${safePixelId}');
fbq('track', 'PageView');
                `.trim(),
              }}
            />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${safePixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
