import { Router } from 'express';
import { getState } from '../controllers/state.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/', requireAuth, asyncHandler(getState));

export default router;
