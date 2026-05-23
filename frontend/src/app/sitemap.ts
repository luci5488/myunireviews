import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  const now = new Date();

  return [
    { url: base,                            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/professors`,            lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/reviews`,               lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/compare`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/professors/suggest`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/faq`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/guidelines`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`,               lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/terms`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
