import { Router } from 'express';
import chatRoutes from './chatRoutes.js';
import healthRoutes from './healthRoutes.js';
const router = Router();
// API 路由
router.use('/api', chatRoutes); // 聊天 + 会话管理 + 向量记忆
// 健康检查路由 (直接在根路径)
router.use('/', healthRoutes);
export default router;
