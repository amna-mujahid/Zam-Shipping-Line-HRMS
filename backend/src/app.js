// Express app: middleware, /api routes, error handling and (in production) the built frontend.
import path from 'path';
import fs from 'fs';
import express from 'express';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRoutes);

  // In production the backend also serves the built frontend, so one process is enough.
  if (env.isProd) {
    const dist = path.resolve(import.meta.dirname, '../../frontend/dist');
    if (!fs.existsSync(dist)) console.warn('  frontend/dist not found — run `npm run build` first.');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
};
