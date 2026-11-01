import { Router } from 'express';
import { executeAction } from '../controllers/action.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.post('/:name', requireAuth, asyncHandler(executeAction));

export default router;
