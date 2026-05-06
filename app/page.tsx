import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HowToBuy } from "@/components/home/HowToBuy";
import { AboutMadd } from "@/components/home/AboutMadd";

export const metadata: Metadata = {
  title: {
    absolute: "Coleccionables | Argentina | MADD.",
  },
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <CategoryGrid />
        <FeaturedProducts />
        <HowToBuy />
        <AboutMadd />
      </main>
      <Footer />
    </>
  );
}
