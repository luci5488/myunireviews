import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Only initialize in production — dev mode has its own CSP that blocks Sentry,
// and you can see errors directly in the browser console anyway.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProd = process.env.NODE_ENV === 'production';

if (dsn && isProd) {
  Sentry.init({
    dsn,
    environment: 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}
