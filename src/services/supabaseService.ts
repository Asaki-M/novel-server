import type { ChatMessage } from '../types/chat.js'
import supabase from '../config/supabase.js'
import { createLogger } from '../utils/logger.js'
import characterService from './characterService.js'

const logger = createLogger('SupabaseService')

class SupabaseController {
  /**
   * 从数据库里面获取对应会话的消息内容
   * @param sessionId
   */
  public async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    if (!sessionId) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) {
        throw error
      }

      return (data || []).map((row: any) => ({
        role: row.role,
        content: row.content,
      }))
    }
    catch (error) {
      logger.error('获取会话历史失败:', error)
      return []
    }
  }

  /**
   * 保存消息到数据库
   * @param sessionId
   * @param messages
   */
  public async saveSessionMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    if (!sessionId || messages.length === 0) {
      return
    }

    try {
      const rows = messages.map(m => ({
        session_id: sessionId,
        role: m.role,
        content: m.content,
      }))

      const { error } = await supabase.from('chat_messages').insert(rows)
      if (error) {
        throw error
      }

      logger.info(`保存了 ${messages.length} 条消息到会话 ${sessionId}`)
    }
    catch (error) {
      logger.error('保存消息失败:', error)
    }
  }

  /**
   * 通过角色卡id获取对应的prompt
   * @param characterId
   */
  public async getCharacterPrompt(characterId: string): Promise<string> {
    if (!characterId) {
      return ''
    }

    try {
      const character = await characterService.getCharacter(characterId)
      if (character) {
        logger.info(`使用了角色卡：${character.name}`)
        return character.systemPrompt
      }
      else {
        logger.warn(`角色卡不存在: ${characterId}`)
        return ''
      }
    }
    catch (error) {
      logger.error(`获取角色卡失败: ${error}`)
      return ''
    }
  }
}

export default new SupabaseController()
