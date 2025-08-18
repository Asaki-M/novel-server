import { Router } from 'express';
import chatRoutes from './chatRoutes.js';

const router = Router();

// 仅保留 API 路由
router.use('/api', chatRoutes);

export default router; 