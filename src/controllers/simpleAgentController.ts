import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, ChatRequest, ChatResponse } from '../types/chat.js'
import simpleAgent from '../agent/simpleAgent.js'
import characterService from '../services/characterService.js'

/**
 * 简洁的 Agent 控制器
 *
 * 提供基于 LangChain + MCP 的智能聊天接口
 * 保持现有的角色卡和会话记录功能
 */

interface SimpleAgentRequest extends ChatRequest {
  characterId: string // 角色卡ID（必填）
  sessionId: string // 会话ID（必填）
  verbose?: boolean // 是否输出详细日志
}

/**
 * 参数验证和角色卡处理
 */
async function validateAndProcessRequest(req: Request) {
  const {
    messages,
    temperature,
    max_tokens,
    characterId,
    sessionId,
    verbose = false,
  } = req.body as SimpleAgentRequest

  // 基本参数验证
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('请提供有效的消息数组')
  }

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId 是必需的')
  }

  if (!characterId || typeof characterId !== 'string' || characterId.trim().length === 0) {
    throw new Error('characterId 是必需的')
  }

  // 获取最后一条用户消息
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('最后一条消息必须是用户消息')
  }

  // 处理角色卡
  let systemPrompt: string | undefined
  if (characterId) {
    const character = await characterService.getCharacter(characterId)
    if (character) {
      systemPrompt = character.systemPrompt
      console.log('🎭 使用角色卡:', character.name)
    }
    else {
      console.warn('角色卡不存在:', characterId)
    }
  }

  return {
    input: lastMessage.content,
    temperature,
    maxTokens: max_tokens,
    sessionId,
    systemPrompt,
    verbose,
  }
}

/**
 * Agent 聊天接口 - 正常响应
 *
 * POST /api/simple-agent/chat
 */
export async function simpleAgentChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      input,
      temperature,
      maxTokens,
      sessionId,
      systemPrompt,
      verbose,
    } = await validateAndProcessRequest(req)

    console.log(`🤖 SimpleAgent 开始处理: ${input.substring(0, 100)}...`)

    // 调用 SimpleAgent
    const agentOptions: any = {
      sessionId,
      systemPrompt,
      verbose,
    }
    if (typeof temperature === 'number') {
      agentOptions.temperature = temperature
    }
    if (typeof maxTokens === 'number') {
      agentOptions.maxTokens = maxTokens
    }

    const result = await simpleAgent.execute(input, agentOptions)

    // 构建响应
    const response: ChatResponse = {
      success: true,
      message: result.output,
      // 如果启用了 verbose，返回调试信息
      ...(verbose && {
        debug: {
          toolsUsed: result.toolsUsed,
          intermediateSteps: result.intermediateSteps,
        },
      }),
    }

    console.log('🤖 SimpleAgent 处理完成')
    res.json(response)
  }
  catch (error) {
    console.error('SimpleAgent 聊天接口错误:', error)
    next(error)
  }
}

/**
 * Agent 聊天接口 - 流式响应
 *
 * POST /api/simple-agent/chat/stream
 */
export async function simpleAgentChatStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      input,
      temperature,
      maxTokens,
      sessionId,
      systemPrompt,
      verbose,
    } = await validateAndProcessRequest(req)

    console.log(`🤖 SimpleAgent 开始流式处理: ${input.substring(0, 100)}...`)

    // 设置流式响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    try {
      // 使用 SimpleAgent 流式执行
      const streamOptions: any = {
        sessionId,
        systemPrompt,
        verbose,
      }
      if (typeof temperature === 'number') {
        streamOptions.temperature = temperature
      }
      if (typeof maxTokens === 'number') {
        streamOptions.maxTokens = maxTokens
      }

      for await (const chunk of simpleAgent.executeStream(input, streamOptions)) {
        if (chunk) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
        }
      }

      res.write('data: [DONE]\n\n')
      res.end()
      console.log('🤖 SimpleAgent 流式处理完成')
    }
    catch (streamError) {
      console.error('SimpleAgent 流式处理错误:', streamError)
      res.write(`data: ${JSON.stringify({
        error: streamError instanceof Error ? streamError.message : '处理请求时出现错误',
      })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
  catch (error) {
    console.error('SimpleAgent 流式聊天接口错误:', error)
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
      })
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误',
      }))
    }
  }
}

/**
 * Agent 健康检查
 *
 * GET /api/simple-agent/health
 */
export async function simpleAgentHealthCheck(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const health = await simpleAgent.healthCheck()

    const response: ApiResponse = {
      success: health.agent && health.mcp,
      message: health.agent && health.mcp ? 'SimpleAgent 服务运行正常' : 'SimpleAgent 服务异常',
      data: {
        status: health.agent && health.mcp ? 'healthy' : 'unhealthy',
        components: {
          langchain: health.agent ? 'healthy' : 'unhealthy',
          mcp: health.mcp ? 'healthy' : 'unhealthy',
        },
        timestamp: new Date().toISOString(),
      },
    }

    const statusCode = health.agent && health.mcp ? 200 : 503
    res.status(statusCode).json(response)
  }
  catch (error) {
    console.error('SimpleAgent 健康检查失败:', error)

    const response: ApiResponse = {
      success: false,
      error: 'SimpleAgent 健康检查异常',
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
      },
    }

    res.status(500).json(response)
  }
}

/**
 * 获取 Agent 信息
 *
 * GET /api/simple-agent/info
 */
export async function simpleAgentInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        name: 'SimpleAgent',
        description: '基于 LangChain + MCP 的简洁智能代理',
        architecture: 'LangChain Agent → MCP Client → MCP Server → Tools',
        features: [
          '意图识别',
          '文生图',
          '角色卡支持',
          '会话记忆',
          '上下文总结',
        ],
        tools: [
          {
            name: 'intent_recognition',
            description: '识别用户消息的意图',
            provider: 'MCP Server',
          },
          {
            name: 'generate_illustration',
            description: '根据文本描述生成插画图片',
            provider: 'MCP Server',
          },
          {
            name: 'langchain_chat',
            description: 'LangChain 对话和记忆管理',
            provider: 'LangChain Service',
          },
        ],
        version: '1.0.0',
      },
    }

    res.json(response)
  }
  catch (error) {
    console.error('获取 SimpleAgent 信息失败:', error)
    next(error)
  }
}
