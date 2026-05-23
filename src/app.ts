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

// ── Security & parsing ─────────────────────────────────────────
app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  logger.fatal('FATAL: CORS_ORIGIN must be set in production.');
  process.exit(1);
}
app.use(cors({ origin: corsOrigin ?? '*', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '64kb' }));

// ── Rate limiting ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});


const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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
app.use('/api/auth',        authLimiter,  authRoutes);
app.use('/api/reviews',     readLimiter,  reviewRoutes);
app.use('/api/institutions',readLimiter,  institutionRoutes);
app.use('/api/courses',     readLimiter,  courseRoutes);
app.use('/api/professors',  readLimiter,  professorRoutes);
app.use('/api/moderation',  writeLimiter, moderationRoutes);
app.use('/api/search',      readLimiter,  searchRoutes);
app.use('/api/bookmarks',   readLimiter,  bookmarkRoutes);
app.use('/api/contact',     authLimiter,  contactRoutes);

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// ── Error handlers (must be last) ──────────────────────────────
// Sentry must be set up BEFORE our errorHandler to capture exceptions
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export default app;
