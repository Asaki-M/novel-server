import { Router, Router as ExpressRouter } from 'express';
import {
  getCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter
} from '../controllers/characterController.js';

/**
 * 角色卡路由配置
 * 
 * 提供角色卡的 CRUD 操作接口
 */

const router: ExpressRouter = Router();

// ==================== 角色卡 CRUD 接口 ====================

/**
 * 获取角色卡列表
 * 
 * GET /api/characters
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "character-uuid",
 *       "name": "角色名称",
 *       "description": "角色描述",
 *       "systemPrompt": "系统提示词",
 *       "avatar": "头像URL",
 *       "isBuiltIn": false,
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ]
 * }
 */
router.get('/', getCharacters);

/**
 * 获取角色卡详情
 * 
 * GET /api/characters/:characterId
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "data": {
 *     "id": "character-uuid",
 *     "name": "角色名称",
 *     "description": "角色描述",
 *     "systemPrompt": "系统提示词",
 *     "avatar": "头像URL",
 *     "isBuiltIn": false,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get('/:characterId', getCharacter);

/**
 * 创建角色卡
 * 
 * POST /api/characters
 * 
 * 请求体示例：
 * {
 *   "name": "角色名称",
 *   "description": "角色描述",
 *   "systemPrompt": "系统提示词",
 *   "avatar": "头像URL（可选）"
 * }
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "message": "角色卡创建成功",
 *   "data": {
 *     "id": "character-uuid",
 *     "name": "角色名称",
 *     "description": "角色描述",
 *     "systemPrompt": "系统提示词",
 *     "avatar": "头像URL",
 *     "isBuiltIn": false,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post('/', createCharacter);

/**
 * 更新角色卡
 * 
 * PUT /api/characters/:characterId
 * 
 * 请求体示例：
 * {
 *   "name": "新的角色名称",
 *   "description": "新的角色描述",
 *   "systemPrompt": "新的系统提示词",
 *   "avatar": "新的头像URL"
 * }
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "message": "角色卡更新成功",
 *   "data": {
 *     "id": "character-uuid",
 *     "name": "新的角色名称",
 *     "description": "新的角色描述",
 *     "systemPrompt": "新的系统提示词",
 *     "avatar": "新的头像URL",
 *     "isBuiltIn": false,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.put('/:characterId', updateCharacter);

/**
 * 删除角色卡
 * 
 * DELETE /api/characters/:characterId
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "message": "角色卡删除成功"
 * }
 */
router.delete('/:characterId', deleteCharacter);

export default router;
