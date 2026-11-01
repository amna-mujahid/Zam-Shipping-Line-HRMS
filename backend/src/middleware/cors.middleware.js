// Lets a frontend on another domain (e.g. a separate Vercel project) call the API.
// Allowed origins come from CORS_ORIGIN in .env; with none set, cross-origin calls are refused.
import { env } from '../config/env.js';

export const cors = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
};
