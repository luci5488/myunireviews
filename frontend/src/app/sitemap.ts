import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myunireviews.com';
const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/professors`,            lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/compare`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/professors/suggest`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/faq`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/guidelines`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`,               lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/terms`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Dynamic professor pages
  try {
    const res = await fetch(`${API}/api/professors?limit=500&sort=rating`, {
      next: { revalidate: 3600 }, // revalidate every hour
    });
    if (res.ok) {
      const { data } = await res.json();
      const professorRoutes: MetadataRoute.Sitemap = (data ?? []).map((p: { id: number; updated_at?: string }) => ({
        url: `${BASE}/professors/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
      return [...staticRoutes, ...professorRoutes];
    }
  } catch {
    // Fall back to static routes if API is unavailable
  }

  return staticRoutes;
}
