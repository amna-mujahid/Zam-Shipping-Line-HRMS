// All API routes, mounted under /api.
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import stateRoutes from './state.routes.js';
import actionRoutes from './action.routes.js';
import { notFound } from '../middleware/error.middleware.js';

const router = Router();
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/state', stateRoutes);
router.use('/actions', actionRoutes);
router.use(notFound);

export default router;
