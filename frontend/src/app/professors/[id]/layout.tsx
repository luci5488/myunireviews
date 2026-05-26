import type { Metadata } from 'next';

const API  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3000';
const BASE = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://myunireviews.com';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/api/professors/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return { title: 'Professor | MyUniReviews' };
    const { data: p } = await res.json();
    const name = `${p.first_name} ${p.last_name}`;
    const rating = p.avg_overall_rating
      ? `${Number(p.avg_overall_rating).toFixed(1)}/5`
      : 'No ratings yet';
    const desc = `${p.total_reviews} student review${p.total_reviews !== 1 ? 's' : ''} for ${name}${p.institution_name ? ` at ${p.institution_name}` : ''}. Overall rating: ${rating}.`;
    const title = `${name}${p.institution_name ? ` — ${p.institution_name}` : ''} | MyUniReviews`;

    return {
      title,
      description: desc,
      openGraph: {
        title: `${name} | MyUniReviews`,
        description: desc,
        type: 'profile',
        url: `/professors/${id}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${name} | MyUniReviews`,
        description: desc,
      },
    };
  } catch {
    return { title: 'Professor | MyUniReviews' };
  }
}

async function getJsonLd(id: string) {
  try {
    const res = await fetch(`${API}/api/professors/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const { data: p } = await res.json();
    if (!p) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: `${p.title ? p.title + ' ' : ''}${p.first_name} ${p.last_name}`,
      jobTitle: p.title ?? 'Lecturer',
      worksFor: p.institution_name ? {
        '@type': 'CollegeOrUniversity',
        name: p.institution_name,
      } : undefined,
      url: `${BASE}/professors/${id}`,
      ...(p.total_reviews > 0 && p.avg_overall_rating ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Number(p.avg_overall_rating).toFixed(1),
          reviewCount: p.total_reviews,
          bestRating: '5',
          worstRating: '1',
        },
      } : {}),
    };
  } catch {
    return null;
  }
}

export default async function ProfessorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jsonLd = await getJsonLd(id);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
