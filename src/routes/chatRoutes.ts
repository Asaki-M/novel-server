import { Router, Router as ExpressRouter } from 'express';
import { 
  chat, 

  getCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter
} from '../controllers/chatController.js';

const router: ExpressRouter = Router();

// 聊天接口
router.post('/chat', chat);

// 角色卡管理
router.get('/characters', getCharacters);           // 获取角色卡列表
router.post('/characters', createCharacter);        // 创建角色卡
router.get('/characters/:characterId', getCharacter); // 获取角色卡详情
router.put('/characters/:characterId', updateCharacter); // 更新角色卡
router.delete('/characters/:characterId', deleteCharacter); // 删除角色卡


export default router; 