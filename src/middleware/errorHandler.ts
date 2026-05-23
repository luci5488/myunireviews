import { Request, Response, NextFunction } from 'express';
import Sentry from '../lib/sentry';
import logger from '../lib/logger';

interface DbError extends Error {
  code?: string;
  constraint?: string;
}

export function errorHandler(
  err: DbError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err }, 'Unhandled request error');

  // PostgreSQL unique violation
  if (err.code === '23505') {
    res.status(409).json({ error: 'Duplicate entry' });
    return;
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    res.status(400).json({ error: 'Referenced resource does not exist' });
    return;
  }

  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    res.status(400).json({ error: 'Value out of allowed range' });
    return;
  }

  // PostgreSQL invalid enum / type input
  if (err.code === '22P02') {
    res.status(400).json({ error: 'Invalid value provided' });
    return;
  }

  const status = (err as { status?: number }).status ?? 500;

  // Report unexpected server errors to Sentry
  if (status === 500) {
    Sentry.captureException(err);
  }

  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
