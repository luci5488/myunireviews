import type { Metadata } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
