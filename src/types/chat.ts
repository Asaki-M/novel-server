export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  characterId?: string
  sessionId?: string
  useMemory?: boolean
  // 工具调用（function calling）相关，可选启用
  useTools?: boolean // 是否启用传统工具调用（仅非流式）
  allowedTools?: string[] // 允许使用的工具白名单（默认全部）
  // MCP Agent 相关
  useMCP?: boolean // 是否启用 MCP Agent 智能路由
  intentThreshold?: number // 意图识别置信度阈值（默认 0.7）
}

export interface ChatResponse {
  success: boolean
  message?: string
  data?: {
    response: string
    character?: {
      id: string
      name: string
      avatar?: string
      category: string
    }
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    // MCP Agent 相关字段
    intent?: {
      type: string
      confidence: number
      reasoning: string
    }
    isImageGeneration?: boolean
  }
  error?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}
