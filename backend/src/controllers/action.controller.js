import { runAction } from '../services/action.service.js';

// POST /api/actions/:name  { args: [...] }
export const executeAction = async (req, res) => {
  res.json(await runAction(req.params.name, req.user, req.body?.args));
};
