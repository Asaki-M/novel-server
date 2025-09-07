import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ChatMessage } from '../types/chat.js'
import type { ExternalMcpServerConfig } from './mcp/client/index.js'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLogger } from '../utils/logger.js'
import { mcpClientManager } from './mcp/client/manager.js'
import { getReActModePrompt } from './prompt/index.js'

const logger = createLogger('Agent')

export interface AgentChatOptions {
  sessionId?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface AgentChatResponse {
  content: string
  finalAnswer?: string
  isComplete: boolean
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export class Agent {
  private llm: BaseChatModel
  private systemPrompt: string
  private mcpServers: ExternalMcpServerConfig[]
  private reactSystemPrompt: string

  constructor(llm: BaseChatModel, mcpServers: ExternalMcpServerConfig[]) {
    this.llm = llm
    this.mcpServers = mcpServers
    this.reactSystemPrompt = ''
    // 外部系统提示词，目前这里用来设置角色的提示词
    this.systemPrompt = ''
  }

  public async initAgent() {
    await mcpClientManager.addMultipleClients(this.mcpServers)
    // 获取所有可用工具
    const tools = await mcpClientManager.getAllTools()
    const toolListStr = JSON.stringify(tools, null, 2)
    // 设置 ReAct 模式的系统提示词
    this.reactSystemPrompt = getReActModePrompt(toolListStr)
  }

  public getModel() {
    return this.llm
  }

  public getReActSystemPrompt() {
    return this.reactSystemPrompt
  }

  /**
   * 解析响应内容，提取thought、action、final_answer等
   */
  private parseResponse(content: string): {
    thought?: string | undefined
    action?: string | undefined
    finalAnswer?: string | undefined
    isComplete: boolean
  } {
    const thoughtMatch = content.match(/<thought>(.*?)<\/thought>/s)
    const actionMatch = content.match(/<action>(.*?)<\/action>/s)
    const finalAnswerMatch = content.match(/<final_answer>(.*?)<\/final_answer>/s)

    return {
      thought: thoughtMatch?.[1]?.trim(),
      action: actionMatch?.[1]?.trim(),
      finalAnswer: finalAnswerMatch?.[1]?.trim(),
      isComplete: !!finalAnswerMatch,
    }
  }

  /**
   * 执行工具调用
   */
  private async executeTool(actionText: string): Promise<string> {
    try {
      // 解析工具调用格式，假设格式为: toolName(param1, param2, ...)
      const match = actionText.match(/(\w+)\((.*)\)/)
      if (!match) {
        return `错误：无法解析工具调用格式: ${actionText}`
      }

      const [, toolName, paramsStr] = match
      let params: any[] = []

      if (paramsStr && paramsStr.trim()) {
        try {
          // 简单的参数解析，支持字符串和数字
          params = paramsStr.split(',').map((p) => {
            const trimmed = p.trim()
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              return trimmed.slice(1, -1)
            }
            if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) {
              return trimmed.slice(1, -1)
            }
            if (!Number.isNaN(Number(trimmed))) {
              return Number(trimmed)
            }
            return trimmed
          })
        }
        catch (error) {
          logger.error('解析工具参数失败:', error)
          return `错误：无法解析工具参数: ${paramsStr ?? ''}`
        }
      }

      // 通过MCP管理器调用工具
      // 这里需要根据实际的工具格式调整
      const allTools = await mcpClientManager.getAllTools()

      // 查找工具所属的客户端
      let clientName = ''
      let toolFound = false

      for (const [client, tools] of Object.entries(allTools)) {
        if (tools && typeof tools === 'object') {
          for (const tool of Object.values(tools)) {
            if (typeof tool === 'object' && tool !== null && 'name' in tool && tool.name === toolName) {
              clientName = client
              toolFound = true
              break
            }
          }
        }
        if (toolFound) {
          break
        }
      }

      if (!toolFound) {
        return `错误：未找到工具: ${toolName}`
      }

      const result = await mcpClientManager.callTool(clientName, toolName as string, params)
      return JSON.stringify(result, null, 2)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('工具执行失败:', error)
      return `错误：工具执行失败: ${errorMessage}`
    }
  }

  /**
   * 将ChatMessage转换为LangChain消息格式
   */
  private convertToLangChainMessages(messages: ChatMessage[]) {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'user':
          return new HumanMessage(msg.content)
        case 'assistant':
          return new AIMessage(msg.content)
        case 'system':
          return new SystemMessage(msg.content)
        default:
          return new HumanMessage(msg.content)
      }
    })
  }

  /**
   * ReAct模式聊天
   * @param messages 消息列表
   * @param options 聊天选项
   * @returns 聊天响应
   */
  public async chat(messages: ChatMessage[], _options?: AgentChatOptions): Promise<AgentChatResponse> {
    const MAX_ITERATIONS = 8 // 最大循环次数，防止无限循环
    const currentMessages = [...messages]
    let totalTokens = 0
    let promptTokens = 0
    let completionTokens = 0

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      try {
        logger.info(`开始第 ${iteration + 1} 轮思考...`)

        // 转换为LangChain消息格式
        const langChainMessages = this.convertToLangChainMessages(currentMessages)

        // 调用LLM获取响应
        const response = await this.llm.invoke(langChainMessages)

        const content = response.content?.toString() || ''
        logger.info(`第 ${iteration + 1} 轮响应:`, content)

        // 累计token使用量
        if (response.usage_metadata) {
          promptTokens += response.usage_metadata.input_tokens || 0
          completionTokens += response.usage_metadata.output_tokens || 0
          totalTokens += response.usage_metadata.total_tokens || 0
        }

        // 解析响应
        const parsedResponse = this.parseResponse(content)

        // 如果已经有最终答案，直接返回
        if (parsedResponse.isComplete && parsedResponse.finalAnswer) {
          logger.info('获得最终答案，结束思考循环')
          return {
            content: parsedResponse.finalAnswer,
            finalAnswer: parsedResponse.finalAnswer,
            isComplete: true,
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
            },
          }
        }

        // 如果有action，执行工具调用
        if (parsedResponse.action) {
          logger.info(`执行工具调用: ${parsedResponse.action}`)
          const observation = await this.executeTool(parsedResponse.action)

          // 将助手的思考和行动添加到消息历史
          currentMessages.push({
            role: 'assistant',
            content,
          })

          // 添加观察结果
          currentMessages.push({
            role: 'user',
            content: `<observation>${observation}</observation>`,
          })

          logger.info(`工具执行结果: ${observation}`)
        }
        else {
          // 如果没有action也没有final_answer，说明格式有问题
          logger.warn('响应格式不正确，缺少action或final_answer')
          return {
            content: '抱歉，我遇到了一些问题，无法正确处理您的请求。',
            isComplete: true,
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
            },
          }
        }
      }
      catch (error) {
        logger.error(`第 ${iteration + 1} 轮思考发生错误:`, error)
        return {
          content: '抱歉，处理您的请求时发生了错误。',
          isComplete: true,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }
      }
    }

    // 如果达到最大迭代次数仍未完成
    logger.warn(`达到最大迭代次数 ${MAX_ITERATIONS}，强制结束`)
    return {
      content: '抱歉，我需要更多时间来思考这个问题，请稍后再试。',
      isComplete: true,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    }
  }
}
