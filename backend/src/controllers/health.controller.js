import { checkConnection, dbConfig } from '../config/database.js';

export const health = async (req, res) => {
  await checkConnection();
  res.json({ ok: true, database: dbConfig.database });
};
