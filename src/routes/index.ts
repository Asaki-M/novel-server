import type { Router as ExpressRouter } from 'express'
import { Router } from 'express'
import characterRoutes from './characterRoutes.js'
import chatRoutes from './chatRoutes.js'
import memoryRoutes from './memoryRoutes.js'

const router: ExpressRouter = Router()

// API 路由
router.use('/api', chatRoutes) // 聊天接口
router.use('/api/characters', characterRoutes) // 角色卡管理接口
router.use('/api/memory', memoryRoutes) // 记忆管理接口

// 根路径
router.use('/', (_req, res) => {
  res.send('Welcome to Novel Chat Server')
})

export default router
