import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Opiniones } from "@/components/home/Opiniones";
import { HowToBuy } from "@/components/home/HowToBuy";
import { AboutMadd } from "@/components/home/AboutMadd";
import { getAvailableProductsCount } from "@/lib/queries";

export const metadata: Metadata = {
  title: {
    absolute: "Coleccionables | Argentina | MADD.",
  },
};

// Cache rendered HTML at Vercel's edge for 5 minutes. Catalog/product mutations
// trigger revalidation explicitly via revalidatePath in admin actions.
export const revalidate = 300;

export default async function HomePage() {
  const availableCount = await getAvailableProductsCount();
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero availableCount={availableCount} />
        <CategoryGrid />
        <FeaturedProducts />
        <Opiniones />
        <HowToBuy />
        <AboutMadd />
      </main>
      <Footer />
    </>
  );
}
