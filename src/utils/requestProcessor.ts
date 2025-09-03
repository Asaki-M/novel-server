import type { Request } from 'express'
import type { ChatRequest } from '../types/chat.js'
import characterService from '../services/characterService.js'

/**
 * 请求处理工具
 *
 * 提供通用的请求验证和处理逻辑
 * 从控制器中抽离出来，保持代码复用
 */

/**
 * 聊天请求处理结果
 */
export interface ProcessedChatRequest {
  messages: any[]
  temperature?: number | undefined
  max_tokens?: number | undefined
  sessionId: string
  systemPrompt?: string | undefined
}

/**
 * 验证和处理聊天请求
 *
 * @param req - Express 请求对象
 * @returns 处理后的请求数据
 * @throws Error - 验证失败时抛出错误
 */
export async function validateAndProcessChatRequest(req: Request): Promise<ProcessedChatRequest> {
  const {
    messages,
    temperature,
    max_tokens,
    characterId, // 必填：角色卡ID
    sessionId, // 必填：会话ID
  } = req.body as ChatRequest & {
    characterId: string
    sessionId: string
  }

  // 验证基本参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('请提供有效的消息数组')
  }

  // sessionId 和 characterId 是必填的
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId 是必需的')
  }

  if (!characterId || typeof characterId !== 'string' || characterId.trim().length === 0) {
    throw new Error('characterId 是必需的')
  }

  // 处理角色卡，获取系统提示词
  const systemPrompt = await processCharacter(characterId)

  return {
    messages,
    temperature,
    max_tokens,
    sessionId,
    systemPrompt,
  }
}

/**
 * 处理角色卡逻辑
 *
 * @param characterId - 角色卡ID
 * @returns 系统提示词（如果角色卡存在）
 */
export async function processCharacter(characterId: string): Promise<string | undefined> {
  if (!characterId) {
    return undefined
  }

  try {
    const character = await characterService.getCharacter(characterId)
    if (character) {
      console.log('🎭 使用角色卡:', character.name)
      return character.systemPrompt
    }
    else {
      console.warn('⚠️ 角色卡不存在:', characterId)
      return undefined
    }
  }
  catch (error) {
    console.error('❌ 获取角色卡失败:', error)
    return undefined
  }
}

/**
 * 验证角色卡ID
 *
 * @param characterId - 角色卡ID
 * @throws Error - 验证失败时抛出错误
 */
export function validateCharacterId(characterId: string): void {
  if (!characterId || typeof characterId !== 'string' || characterId.trim().length === 0) {
    throw new Error('角色卡ID不能为空')
  }
}

/**
 * 验证会话ID
 *
 * @param sessionId - 会话ID
 * @throws Error - 验证失败时抛出错误
 */
export function validateSessionId(sessionId: string): void {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('会话ID不能为空')
  }
}
