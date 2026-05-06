import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, DM_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://madd-collectibles.vercel.app";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${bebas.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-deep text-text-primary font-body">
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
