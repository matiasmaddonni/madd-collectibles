import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <CategoryGrid />
        <FeaturedProducts />
      </main>
    </>
  );
}
