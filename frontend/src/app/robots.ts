import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/my-reviews', '/bookmarks', '/moderation/', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
