// Requires "Authorization: Bearer <token>" and sets req.user.
import { authenticate } from '../services/auth.service.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const { user, error } = await authenticate(header.startsWith('Bearer ') ? header.slice(7) : null);
    if (error) return res.status(401).json({ ok: false, error });
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};
