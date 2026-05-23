import type { NextConfig } from 'next';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const isProd = process.env.NODE_ENV === 'production';

// CSP is only enforced in production — dev mode skips it so Sentry,
// hot reload, and other dev tools work without fighting the policy.
const csp = isProd ? [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self'`,
  `connect-src 'self' ${API_ORIGIN} https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ') : null;

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },
  // Tell Next.js that the project root is the frontend directory, not the
  // monorepo root — silences the "multiple lockfiles" workspace warning.
  outputFileTracingRoot: __dirname,

  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(csp ? [{ key: 'Content-Security-Policy', value: csp }] : []),
    ];
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
