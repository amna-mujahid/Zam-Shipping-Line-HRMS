import { buildState } from '../services/state.service.js';

// GET /api/state — everything the signed-in user's role may see.
export const getState = async (req, res) => {
  res.json({ ok: true, state: await buildState(req.user) });
};
