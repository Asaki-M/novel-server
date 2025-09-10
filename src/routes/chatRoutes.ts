import type { Router as ExpressRouter, Request, Response } from 'express'
import type AgentChatController from '../controllers/agentChatController.js'
import { Router } from 'express'

const router: ExpressRouter = Router()

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

router.post('/agent/chat/stream', (req: Request, res: Response) => {
  const agentChatController = req.app.get('agentChatController') as AgentChatController
  if (!agentChatController) {
    return res.status(500).json({
      success: false,
      message: 'Agent chat controller not initialized',
    })
  }
  return agentChatController.streamChat(req, res)
})

export default router
