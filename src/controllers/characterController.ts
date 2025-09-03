import type { NextFunction, Request, Response } from 'express'
import type { CreateCharacterRequest, UpdateCharacterRequest } from '../types/character.js'
import type { ApiResponse } from '../types/chat.js'
import characterService from '../services/characterService.js'

/**
 * 角色卡控制器
 *
 * 专门处理角色卡的 CRUD 操作
 * 从 chatController 中分离出来，保持单一职责
 */

/**
 * 获取角色卡列表
 * GET /api/characters
 */
export async function getCharacters(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await characterService.listCharacters()

    const response: ApiResponse = {
      success: true,
      data: list,
    }

    res.json(response)
  }
  catch (error) {
    next(error)
  }
}

/**
 * 获取角色卡详情
 * GET /api/characters/:characterId
 */
export async function getCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { characterId } = req.params

    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空',
      }
      res.status(400).json(response)
      return
    }

    const character = await characterService.getCharacter(characterId)

    if (!character) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在',
      }
      res.status(404).json(response)
      return
    }

    const response: ApiResponse = {
      success: true,
      data: character,
    }

    res.json(response)
  }
  catch (error) {
    next(error)
  }
}

/**
 * 创建角色卡
 * POST /api/characters
 */
export async function createCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const characterData: CreateCharacterRequest = req.body

    // 验证必填字段
    if (!characterData.name || !characterData.description || !characterData.systemPrompt) {
      const response: ApiResponse = {
        success: false,
        error: '角色名称、描述和系统提示词为必填项',
      }
      res.status(400).json(response)
      return
    }

    const character = await characterService.createCharacter(characterData)

    const response: ApiResponse = {
      success: true,
      message: '角色卡创建成功',
      data: character,
    }

    res.status(201).json(response)
  }
  catch (error) {
    next(error)
  }
}

/**
 * 更新角色卡
 * PUT /api/characters/:characterId
 */
export async function updateCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { characterId } = req.params
    const updates: UpdateCharacterRequest = req.body

    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空',
      }
      res.status(400).json(response)
      return
    }

    const character = await characterService.updateCharacter(characterId, updates)

    if (!character) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在或无法修改内置角色',
      }
      res.status(404).json(response)
      return
    }

    const response: ApiResponse = {
      success: true,
      message: '角色卡更新成功',
      data: character,
    }

    res.json(response)
  }
  catch (error) {
    next(error)
  }
}

/**
 * 删除角色卡
 * DELETE /api/characters/:characterId
 */
export async function deleteCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { characterId } = req.params

    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空',
      }
      res.status(400).json(response)
      return
    }

    const deleted = await characterService.deleteCharacter(characterId)

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在或无法删除内置角色',
      }
      res.status(404).json(response)
      return
    }

    const response: ApiResponse = {
      success: true,
      message: '角色卡删除成功',
    }

    res.json(response)
  }
  catch (error) {
    next(error)
  }
}
