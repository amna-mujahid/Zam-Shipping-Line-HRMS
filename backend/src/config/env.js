// Loads backend/.env (whatever folder the process was started from) and exposes typed settings.
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) {
  console.warn('[auth] AUTH_SECRET is not set in .env — using a random secret; sessions end when the server restarts.');
}

export const env = {
  port: Number(process.env.PORT || 4000),
  isProd: process.argv.includes('--prod') || process.env.NODE_ENV === 'production',
  authSecret,
  tokenTtlMs: 12 * 60 * 60 * 1000,
  autoAbsentDays: Number(process.env.AUTO_ABSENT_DAYS ?? 31),
  // Comma-separated frontend URLs allowed to call the API from another domain.
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zam_hrms',
    // Managed hosts like Aiven require TLS; set DB_SSL=true to enable.
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
  },
};
