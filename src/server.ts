// Sentry must be imported and initialized before everything else
import './lib/sentry';

import app from './app';
import { pool } from './config/db';
import logger from './lib/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function start() {
  // Fail fast if secrets are missing or dangerously weak
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    logger.fatal('FATAL: JWT_SECRET must be set and at least 32 characters long.');
    process.exit(1);
  }

  // Verify DB connectivity before accepting traffic
  await pool.query('SELECT 1');
  logger.info('Database connected');

  app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'Server running');
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
