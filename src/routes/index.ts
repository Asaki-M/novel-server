import { Router, Router as ExpressRouter } from 'express';
import chatRoutes from './chatRoutes.js';
import characterRoutes from './characterRoutes.js';
import memoryRoutes from './memoryRoutes.js';
import simpleAgentRoutes from './simpleAgentRoutes.js';

const router: ExpressRouter = Router();

// API 路由
router.use('/api', chatRoutes);                // 聊天接口
router.use('/api/characters', characterRoutes); // 角色卡管理接口
router.use('/api/memory', memoryRoutes);        // 记忆管理接口
router.use('/api/agent', simpleAgentRoutes);    // 基于 LangChain + MCP 的简洁 Agent

// 根路径
router.use('/', (_req, res) => {
  res.send('Welcome to Novel Chat Server');
})

export default router; 