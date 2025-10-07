import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Request, Response } from 'express'
import type { ExternalMcpServerConfig } from '../agent/index.js'
import type { RAGSearchDocument } from '../services/ragService.js'
import type { Character } from '../types/character.js'
import type { ChatMessage } from '../types/chat.js'
import { Agent } from '../agent/index.js'
import ragService from '../services/ragService.js'
import supabaseService from '../services/supabaseService.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('AgentChatController')

interface ChatRequestBody {
  sessionId: string
  characterId: string
  message: string
  knowledgeName?: string
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
    const { reactSystemPrompt, characterSystemPrompt, knowledgeDocumentsSystemPrompt } = systemPrompt

    // 添加ReAct系统提示词
    if (reactSystemPrompt) {
      messages.push({ role: 'system', content: reactSystemPrompt })
    }

    // 添加角色系统提示词
    if (characterSystemPrompt) {
      messages.push({ role: 'system', content: characterSystemPrompt })
    }

    // 添加知识库文档系统提示词
    if (knowledgeDocumentsSystemPrompt) {
      messages.push({ role: 'system', content: knowledgeDocumentsSystemPrompt })
    }

    // 添加历史对话
    messages.push(...history)

    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessage })

    return messages
  }

  private buildKnowledgeDocumentsSystemPrompt(documents: RAGSearchDocument[]) {
    const documentsText = documents.map((doc: RAGSearchDocument, index: number) =>
      `文档 ${index + 1} (相关度: ${doc.relevance_score}):\n${doc.document.text}`,
    ).join('\n\n---\n\n')

    return `以下是相关的知识库文档，请基于这些文档内容回答用户的问题，不要编造信息：\n\n${documentsText}`
  }

  /**
   * 普通聊天请求函数
   */
  public async chat(req: Request, res: Response) {
    const { sessionId, characterId, message, knowledgeName } = req.body as ChatRequestBody
    const { status, errorMessage } = this.validateChatRequest(req.body)

    if (status !== 200 && errorMessage) {
      return res.status(status).json({
        message: errorMessage,
      })
    }

    let knowledgeDocumentsSystemPrompt = ''
    if (knowledgeName) {
      const documents = await ragService.searchDocuments(message, knowledgeName)
      knowledgeDocumentsSystemPrompt = this.buildKnowledgeDocumentsSystemPrompt(documents)
    }

    try {
      const characterInfo: Character | null = await supabaseService.getCharacterInfo(characterId)
      let characterPrompt = ''
      if (characterInfo) {
        characterPrompt = characterInfo.systemPrompt
      }

      const messageList = this.buildMessages(
        `<task>${message}</task>`,
        [],
        {
          reactSystemPrompt: this.agent.getReActSystemPrompt(),
          characterSystemPrompt: characterPrompt,
          knowledgeDocumentsSystemPrompt,
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

  /**
   * 流式聊天请求函数
   */
  public async streamChat(req: Request, res: Response): Promise<void> {
    const { sessionId, characterId, message, knowledgeName } = req.body as ChatRequestBody
    const { status, errorMessage } = this.validateChatRequest(req.body)

    if (status !== 200 && errorMessage) {
      res.status(status).json({
        message: errorMessage,
      })
      return
    }

    let knowledgeDocumentsSystemPrompt = ''
    if (knowledgeName) {
      const documents = await ragService.searchDocuments(message, knowledgeName)
      knowledgeDocumentsSystemPrompt = this.buildKnowledgeDocumentsSystemPrompt(documents)
    }

    try {
      // 设置流式响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      const characterInfo: Character | null = await supabaseService.getCharacterInfo(characterId)
      let characterPrompt = ''
      if (characterInfo) {
        characterPrompt = characterInfo.systemPrompt
      }

      const messageList = this.buildMessages(
        `<task>${message}</task>`,
        [],
        {
          reactSystemPrompt: this.agent.getReActSystemPrompt(),
          characterSystemPrompt: characterPrompt,
          knowledgeDocumentsSystemPrompt,
        },
      )

      let finalAnswer = ''
      let hasError = false

      // 使用Agent的流式ReAct模式进行聊天
      for await (const chunk of this.agent.streamChat(messageList)) {
        // 发送流式数据
        res.write(`data: ${JSON.stringify({
          type: chunk.type,
          content: chunk.content,
          iteration: chunk.iteration,
          action: chunk.action,
          isComplete: chunk.isComplete,
          usage: chunk.usage,
        })}\n\n`)

        // 记录最终答案
        if (chunk.type === 'final_answer') {
          finalAnswer = chunk.content
        }

        // 记录错误状态
        if (chunk.type === 'error') {
          hasError = true
          finalAnswer = chunk.content
        }

        // 如果完成，跳出循环
        if (chunk.isComplete) {
          break
        }
      }

      // 保存用户消息和助手回复到数据库
      if (finalAnswer && !hasError) {
        await supabaseService.saveSessionMessages(sessionId, [
          {
            role: 'user',
            content: message,
          },
          {
            role: 'assistant',
            content: finalAnswer,
          },
        ])
      }

      // 发送完成信号
      res.write('data: [DONE]\n\n')
      res.end()
    }
    catch (error) {
      logger.error('Stream chat error:', error)

      // 发送错误信息
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: 'Internal server error',
        isComplete: true,
      })}\n\n`)

      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
}

export default AgentChatController
