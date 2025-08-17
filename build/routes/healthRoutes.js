import { Router } from 'express';
import { healthCheck } from '../controllers/healthController.js';
const router = Router();
// 健康检查
router.get('/health', healthCheck);
export default router;
