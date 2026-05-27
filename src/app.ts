import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import logger from './lib/logger';

import authRoutes        from './routes/auth';
import institutionRoutes from './routes/institutions';
import courseRoutes      from './routes/courses';
import professorRoutes   from './routes/professors';
import reviewRoutes      from './routes/reviews';
import moderationRoutes  from './routes/moderation';
import searchRoutes      from './routes/search';
import bookmarkRoutes    from './routes/bookmarks';
import contactRoutes     from './routes/contact';
import { errorHandler }  from './middleware/errorHandler';
import Sentry            from './lib/sentry';

const app = express();

// Trust Railway's proxy so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

// ── Security & parsing ─────────────────────────────────────────
app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  logger.fatal('FATAL: CORS_ORIGIN must be set in production.');
  process.exit(1);
}
const allowedOrigins = corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : ['*'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '64kb' }));

// ── Rate limiting ──────────────────────────────────────────────
// authLimiter (20/15 min) lives in routes/auth.ts, applied only to
// login / register / forgot-password / reset-password to prevent brute-force.


const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for admin write actions (moderation mutations)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',        readLimiter,  authRoutes);
app.use('/api/reviews',     readLimiter,  reviewRoutes);
app.use('/api/institutions',readLimiter,  institutionRoutes);
app.use('/api/courses',     readLimiter,  courseRoutes);
app.use('/api/professors',  readLimiter,  professorRoutes);
app.use('/api/moderation',  writeLimiter, moderationRoutes);
app.use('/api/search',      readLimiter,  searchRoutes);
app.use('/api/bookmarks',   readLimiter,  bookmarkRoutes);
app.use('/api/contact',     writeLimiter, contactRoutes);

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// ── Error handlers (must be last) ──────────────────────────────
// Sentry must be set up BEFORE our errorHandler to capture exceptions
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export default app;
