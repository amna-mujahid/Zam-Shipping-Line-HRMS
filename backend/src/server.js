// HRMS backend entry point.
//   npm run dev    → API with auto-restart on http://localhost:4000 (frontend proxies /api here)
//   npm start      → API + built frontend from ../frontend/dist (run `npm run build` first)
import { env } from './config/env.js';
import { checkConnection, dbConfig } from './config/database.js';
import { createApp } from './app.js';
import { startJobs } from './jobs/index.js';
import { friendlyDbError } from './utils/errors.js';

createApp().listen(env.port, async () => {
  console.log(`\n  HRMS API running at http://localhost:${env.port}${env.isProd ? ' (serving frontend/dist)' : ''}`);
  try {
    await checkConnection();
    console.log(`  MySQL connected: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}\n`);
    startJobs();
  } catch (err) {
    console.error(`  MySQL NOT connected: ${friendlyDbError(err) || err.message}\n`);
  }
});
