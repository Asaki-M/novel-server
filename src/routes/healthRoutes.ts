import { Router, Router as ExpressRouter } from 'express';
import { dbHealth } from '../controllers/healthController.js';

const router: ExpressRouter = Router();

router.get('/db', dbHealth);

export default router; 