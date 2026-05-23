import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Professor profile on MyUniReviews';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = 'Professor';
  let institution = '';
  let rating = 'No ratings yet';
  let reviews = '0 reviews';
  let initials = '?';
  let title = '';

  try {
    const res = await fetch(`${API}/api/professors/${id}`);
    if (res.ok) {
      const { data: p } = await res.json();
      name = `${p.first_name} ${p.last_name}`;
      institution = p.institution_name ?? '';
      title = p.title ?? '';
      rating = p.avg_overall_rating
        ? `★ ${Number(p.avg_overall_rating).toFixed(1)} / 5`
        : 'No ratings yet';
      reviews = `${p.total_reviews} review${p.total_reviews !== 1 ? 's' : ''}`;
      initials = `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase() || '?';
    }
  } catch { /* use defaults */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '28px' }}>
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50px',
              background: 'rgba(255,255,255,0.15)',
              border: '3px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 800,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '52px', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
              {name}
            </span>
            {title && (
              <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
                {title}
              </span>
            )}
          </div>
        </div>

        {/* Institution */}
        {institution && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '36px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '10px 20px',
            }}
          >
            <span style={{ fontSize: '26px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              🎓 {institution}
            </span>
          </div>
        )}

        {/* Rating + reviews row */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <span style={{ fontSize: '36px', color: '#fbbf24', fontWeight: 800 }}>{rating}</span>
          <span
            style={{
              fontSize: '24px',
              color: 'rgba(255,255,255,0.65)',
              fontWeight: 500,
              borderLeft: '2px solid rgba(255,255,255,0.2)',
              paddingLeft: '40px',
            }}
          >
            {reviews}
          </span>
        </div>

        {/* Brand */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '56px',
            fontSize: '20px',
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          MyUniReviews
        </div>
      </div>
    ),
    { ...size }
  );
}
