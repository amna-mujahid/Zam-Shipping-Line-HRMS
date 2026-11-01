// HMAC-signed session tokens: base64url(payload).signature
import crypto from 'crypto';
import { env } from '../config/env.js';

const sign = (body) => crypto.createHmac('sha256', env.authSecret).update(body).digest('base64url');

export const signToken = (userId) => {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + env.tokenTtlMs })).toString('base64url');
  return `${body}.${sign(body)}`;
};

export const verifyToken = (token) => {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
};
