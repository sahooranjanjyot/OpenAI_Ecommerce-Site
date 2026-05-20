import { MetadataRoute } from "next";
import { prisma } from "../lib/prisma";

/**
 * /sitemap.xml — SEO sitemap (G-032, G-022)
 * Dynamically includes all product pages
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://groceryos.example.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                          lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${baseUrl}/privacy`,             lastModified: new Date(), changeFrequency: "monthly",  priority: 0.3 },
    { url: `${baseUrl}/terms`,               lastModified: new Date(), changeFrequency: "monthly",  priority: 0.3 },
    { url: `${baseUrl}/cookies`,             lastModified: new Date(), changeFrequency: "monthly",  priority: 0.3 },
    { url: `${baseUrl}/track`,               lastModified: new Date(), changeFrequency: "monthly",  priority: 0.5 },
  ];

  // Dynamic product pages
  try {
    const products = await prisma.product.findMany({
      where:  { enabled: true, hidden: false },
      select: { id: true, name: true },
    });

    const productPages: MetadataRoute.Sitemap = products.map(p => ({
      url:             `${baseUrl}/product/${p.id}`,
      lastModified:    new Date(),
      changeFrequency: "daily" as const,
      priority:        0.8,
    }));

    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
