import { Router } from 'express';
import { chat, getModels, createSession, getSession, deleteSession, getCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter, getCharacterStats } from '../controllers/chatController.js';
const router = Router();
// 聊天接口
router.post('/chat', chat);
// 会话管理 (内置向量记忆)
router.post('/sessions', createSession);
router.get('/sessions/:sessionId', getSession);
router.delete('/sessions/:sessionId', deleteSession);
// 角色卡管理
router.get('/characters', getCharacters); // 获取角色卡列表
router.get('/characters/stats', getCharacterStats); // 获取统计信息
router.post('/characters', createCharacter); // 创建角色卡
router.get('/characters/:characterId', getCharacter); // 获取角色卡详情
router.put('/characters/:characterId', updateCharacter); // 更新角色卡
router.delete('/characters/:characterId', deleteCharacter); // 删除角色卡
// 模型管理
router.get('/models', getModels);
export default router;
