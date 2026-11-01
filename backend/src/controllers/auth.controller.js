import { login as loginService } from '../services/auth.service.js';

// POST /api/auth/login  { username, password } — the role comes from the database
export const login = async (req, res) => {
  const { username, password } = req.body || {};
  const result = await loginService(username, password);
  res.status(result.ok ? 200 : 401).json(result);
};

// GET /api/auth/me
export const me = (req, res) => res.json({ ok: true, user: req.user });
