import type { Router as ExpressRouter } from 'express'
import { Router } from 'express'
import {
  simpleAgentChat,
  simpleAgentChatStream,
  simpleAgentHealthCheck,
  simpleAgentInfo,
} from '../controllers/simpleAgentController.js'

/**
 * SimpleAgent 路由配置
 *
 * 提供基于 LangChain + MCP 的简洁智能聊天接口
 */

const router: ExpressRouter = Router()

// ==================== Agent 聊天接口 ====================

router.post('/chat', simpleAgentChat)

router.post('/chat/stream', simpleAgentChatStream)

// ==================== Agent 管理接口 ====================

router.get('/health', simpleAgentHealthCheck)

router.get('/info', simpleAgentInfo)

export default router
