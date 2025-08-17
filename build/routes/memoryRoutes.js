import { Router } from 'express';
import { createSession, getSession, updateSession, deleteSession, getAllSessions, searchSessions, chatWithMemory, getMemoryStats, cleanupSessions, exportSession, importSession } from '../controllers/memoryController.js';
const router = Router();
// 会话管理
router.post('/sessions', createSession); // 创建会话
router.get('/sessions', getAllSessions); // 获取所有会话
router.get('/sessions/search', searchSessions); // 搜索会话
router.get('/sessions/:sessionId', getSession); // 获取会话详情
router.put('/sessions/:sessionId', updateSession); // 更新会话
router.delete('/sessions/:sessionId', deleteSession); // 删除会话
// 聊天相关
router.post('/chat', chatWithMemory); // 带记忆的聊天
// 数据管理
router.get('/stats', getMemoryStats); // 获取统计信息
router.post('/cleanup', cleanupSessions); // 清理旧会话
router.get('/sessions/:sessionId/export', exportSession); // 导出会话
router.post('/sessions/import', importSession); // 导入会话
export default router;
