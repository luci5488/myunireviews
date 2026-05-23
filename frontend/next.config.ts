import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },
  // Tell Next.js that the project root is the frontend directory, not the
  // monorepo root — silences the "multiple lockfiles" workspace warning.
  outputFileTracingRoot: __dirname,

  async headers() {
    // CSP is handled by middleware.ts (nonce-based) — only set other security headers here.
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
