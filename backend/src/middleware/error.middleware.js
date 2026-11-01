import { ActionError, friendlyDbError } from '../utils/errors.js';

export const notFound = (req, res) => res.status(404).json({ ok: false, error: 'Not found' });

// Rule violations → 200 { ok: false }, known MySQL problems → 400, anything else → 500.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof ActionError) return res.json({ ok: false, error: err.message });
  const friendly = friendlyDbError(err);
  if (!friendly) console.error('[api]', err);
  return res.status(friendly ? 400 : 500).json({ ok: false, error: friendly || 'Unexpected server error. See the backend console for details.' });
};
