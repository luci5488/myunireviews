import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MyUniReviews — Find the right professor for your course';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4338ca 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo circle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, background: 'rgba(255,255,255,0.15)', borderRadius: 28, marginBottom: 32 }}>
          <div style={{ fontSize: 72 }}>🎓</div>
        </div>

        <div style={{ fontSize: 64, fontWeight: 800, color: '#ffffff', letterSpacing: '-2px', marginBottom: 16 }}>
          MyUniReviews
        </div>

        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 700 }}>
          Honest professor ratings from Australian university students
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 48, marginTop: 48 }}>
          {[['⭐', 'Real Reviews'], ['🏛️', 'All Unis'], ['🔒', 'Anonymous']].map(([icon, label]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 32 }}>{icon}</div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
