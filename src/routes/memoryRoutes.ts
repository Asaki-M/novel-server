import { Router, Router as ExpressRouter } from 'express';
import { getSessionHistory, clearSessionHistory } from '../controllers/memoryController.js';

const router: ExpressRouter = Router();

router.get('/:sessionId', getSessionHistory);
router.delete('/:sessionId', clearSessionHistory);

export default router; 