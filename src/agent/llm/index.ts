import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'
import config from '../../config/index.js'

// 创建 LLM 实例
export function initLLM(): BaseChatModel {
  const payload = {
    apiKey: config.openrouter.apiKey,
    model: config.openrouter.model,
    temperature: 0.7,
    configuration: {
      baseURL: config.openrouter.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': config.app.referer,
        'X-Title': config.app.name,
      },
    },
  }

  return new ChatOpenAI(payload)
}
