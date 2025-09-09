import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Request, Response } from 'express'
import type { ExternalMcpServerConfig } from '../agent/index.js'
import type { Character } from '../types/character.js'
import type { ChatMessage } from '../types/chat.js'
import { Agent } from '../agent/index.js'
import supabaseService from '../services/supabaseService.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('AgentChatController')

interface ChatRequestBody {
  sessionId: string
  characterId: string
  message: string
}

class AgentChatController {
  private agent: Agent
  constructor(llm: BaseChatModel, externalServers: ExternalMcpServerConfig[]) {
    this.agent = new Agent(llm, externalServers)
  }

  public async init() {
    await this.agent.initAgent()
  }

  /**
   * 验证请求参数
   * @param body
   */
  private validateChatRequest(body: ChatRequestBody) {
    const { sessionId, characterId, message } = body
    if (!sessionId) {
      return {
        status: 400,
        errorMessage: 'sessionId is required',
      }
    }

    if (!characterId) {
      return {
        status: 400,
        errorMessage: 'characterId is required',
      }
    }

    if (!message) {
      return {
        status: 400,
        errorMessage: 'message is required',
      }
    }

    return {
      status: 200,
      errorMessage: null,
    }
  }

  /**
   * 构建消息列表
   * @param userMessage
   * @param history
   * @param systemPrompt
   */
  public buildMessages(userMessage: string, history: ChatMessage[], systemPrompt: Record<string, string>): ChatMessage[] {
    const messages: ChatMessage[] = []
    const { reactSystemPrompt, characterSystemPrompt } = systemPrompt

    // 添加ReAct系统提示词
    if (reactSystemPrompt) {
      messages.push({ role: 'system', content: reactSystemPrompt })
    }

    // 添加角色系统提示词
    if (characterSystemPrompt) {
      messages.push({ role: 'system', content: characterSystemPrompt })
    }

    // 添加历史对话
    messages.push(...history)

    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessage })

    return messages
  }

  /**
   * 普通聊天请求函数
   */
  public async chat(req: Request, res: Response) {
    const { sessionId, characterId, message } = req.body as ChatRequestBody
    const { status, errorMessage } = this.validateChatRequest(req.body)

    if (status !== 200 && errorMessage) {
      return res.status(status).json({
        message: errorMessage,
      })
    }

    try {
      const history = await supabaseService.getSessionHistory(sessionId)
      const characterInfo: Character | null = await supabaseService.getCharacterInfo(characterId)
      let characterPrompt = ''
      if (characterInfo) {
        characterPrompt = characterInfo.systemPrompt
      }

      const messageList = this.buildMessages(
        `<task>${message}</task>`,
        history,
        {
          reactSystemPrompt: this.agent.getReActSystemPrompt(),
          characterSystemPrompt: characterPrompt,
        },
      )

      // 使用Agent的ReAct模式进行聊天
      const agentResponse = await this.agent.chat(messageList)

      // 保存用户消息和助手回复到数据库
      await supabaseService.saveSessionMessages(sessionId, [
        {
          role: 'user',
          content: message,
        },
        {
          role: 'assistant',
          content: agentResponse.finalAnswer || agentResponse.content,
        },
      ])

      // 返回最终答案
      return res.status(200).json({
        success: true,
        data: {
          character: characterInfo,
          message: agentResponse.finalAnswer || agentResponse.content,
          usage: agentResponse.usage,
        },
      })
    }
    catch (error) {
      logger.error(error)
      return res.status(500).json({
        message: 'Internal server error',
      })
    }
  }

  public streamChat() {
    // TODO
    console.log('stream chat')
  }
}

export default AgentChatController
