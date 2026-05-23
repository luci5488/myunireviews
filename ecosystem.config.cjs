module.exports = {
  apps: [
    {
      name: 'ratemyprof-api',
      script: './dist/server.js',
      instances: 'max',       // one process per CPU core
      exec_mode: 'cluster',
      // PM2 doesn't load .env automatically — dotenv inside the app handles it.
      // Make sure a .env file exists in this directory on the production server.
      // See .env.example for the full list of required variables.
      env_production: {
        NODE_ENV: 'production',
      },
      // Restart on crash, but back off if crashing repeatedly
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      // Graceful shutdown: let in-flight requests finish
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Log rotation
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
