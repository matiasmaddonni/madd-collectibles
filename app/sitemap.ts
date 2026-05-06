import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/lib/queries";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://madd-collectibles.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProductSlugs();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/catalogo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries];
}
