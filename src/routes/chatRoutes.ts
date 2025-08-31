import { Router, Router as ExpressRouter } from 'express';
import {
  chat,
  chatStream
} from '../controllers/chatController.js';

/**
 * 聊天路由配置
 *
 * 只处理聊天相关的接口
 * 角色卡管理已移至 characterRoutes
 */

const router: ExpressRouter = Router();

// ==================== 聊天接口 ====================

/**
 * 普通聊天接口
 * POST /api/chat
 */
router.post('/chat', chat);

/**
 * 流式聊天接口
 * POST /api/chat/stream
 */
router.post('/chat/stream', chatStream);

export default router;