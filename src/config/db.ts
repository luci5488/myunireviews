import { Pool } from 'pg';
import 'dotenv/config';
import logger from '../lib/logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  // Do not exit — a transient pool error should not bring down the server.
  logger.error({ err }, 'Unexpected DB client error');
});
