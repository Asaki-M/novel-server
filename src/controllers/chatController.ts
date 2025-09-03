import type { NextFunction, Request, Response } from 'express'
import type { ChatResponse } from '../types/chat.js'
import langchainService from '../services/langchainService.js'
import { validateAndProcessChatRequest } from '../utils/requestProcessor.js'

/**
 * 聊天控制器
 *
 * 处理聊天相关的API请求，包括：
 * 1. 普通聊天
 * 2. 流式聊天
 *
 * 角色卡管理已移至 characterController
 */

/**
 * 普通聊天接口
 * POST /api/chat
 */
export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 使用通用的请求处理工具
    const {
      messages,
      temperature,
      max_tokens,
      sessionId,
      systemPrompt,
    } = await validateAndProcessChatRequest(req)

    // 使用 LangChain 服务，启用记忆功能
    const result = await langchainService.invoke(messages, {
      temperature,
      max_tokens,
      systemPrompt,
      sessionId,
    })

    const response: ChatResponse = {
      success: true,
      message: result.content,
    }

    res.json(response)
  }
  catch (error) {
    next(error)
  }
}

/**
 * 流式聊天接口
 * POST /api/chat/stream
 */
export async function chatStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 使用通用的请求处理工具
    const {
      messages,
      temperature,
      max_tokens,
      sessionId,
      systemPrompt,
    } = await validateAndProcessChatRequest(req)

    // 设置流式响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    // 使用 LangChain 流式响应（默认启用记忆）
    for await (const delta of langchainService.streamWithMemory(messages, {
      temperature,
      max_tokens,
      systemPrompt,
      sessionId,
      summaryWindow: 12,
      summaryMaxTokens: 400,
    })) {
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  }
  catch (error) {
    if (error instanceof Error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    next(error)
  }
}
