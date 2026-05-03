import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, DM_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "MADD. — Curated collectibles. Collector to collector.",
  description:
    "Curaduría obsesiva de Myth Cloth, Myth Cloth EX y S.H.Figuarts. Cada pieza, verificada y fotografiada por nosotros.",
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
        {children}
      </body>
    </html>
  );
}
