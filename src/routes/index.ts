import { Router, Router as ExpressRouter } from 'express';
import chatRoutes from './chatRoutes.js';
import healthRoutes from './healthRoutes.js';

const router: ExpressRouter = Router();

// 仅保留 API 路由
router.use('/api', chatRoutes);
router.use('/api/health', healthRoutes);
router.use('/', (req, res) => {
  res.send('Welcome to Novel Chat Server');
})

export default router; 