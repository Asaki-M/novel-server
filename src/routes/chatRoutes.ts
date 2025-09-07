import type { Router as ExpressRouter, Request, Response } from 'express'
import type AgentChatController from '../controllers/agentChatController.js'
import { Router } from 'express'
import {
  chat,
  chatStream,
} from '../controllers/chatController.js'

/**
 * 聊天路由配置
 *
 * 只处理聊天相关的接口
 * 角色卡管理已移至 characterRoutes
 */

const router: ExpressRouter = Router()

// ==================== 聊天接口 ====================

/**
 * 普通聊天接口
 * POST /api/chat
 */
router.post('/chat', chat)

/**
 * 流式聊天接口
 * POST /api/chat/stream
 */
router.post('/chat/stream', chatStream)

/**
 * Agent ReAct模式聊天接口
 * POST /api/agent/chat
 */
router.post('/agent/chat', (req: Request, res: Response) => {
  const agentChatController = req.app.get('agentChatController') as AgentChatController
  if (!agentChatController) {
    return res.status(500).json({
      success: false,
      message: 'Agent chat controller not initialized',
    })
  }
  return agentChatController.chat(req, res)
})

export default router
