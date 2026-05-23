import pino from 'pino';

const logger = pino(
  process.env.NODE_ENV === 'production'
    ? { level: process.env.LOG_LEVEL ?? 'info' }
    : {
        level: 'debug',
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
      }
);

export default logger;
