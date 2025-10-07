import process from 'node:process'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

interface Config {
  port: number
  openrouter: {
    apiKey: string
    baseUrl: string
    model: string
  }
  app: {
    name: string
    referer: string
  }
  ragServer: {
    baseUrl?: string
  } | null
}

const config: Config = {
  port: Number.parseInt(process.env['PORT'] ?? '3008', 10),
  openrouter: {
    apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: process.env['OPENROUTER_MODEL'] ?? 'google/gemma-3n-e2b-it:free',
  },
  app: {
    name: 'Novel Server Chat API',
    referer: process.env['APP_REFERER'] ?? 'http://localhost:3000',
  },
  ragServer: {
    baseUrl: process.env['RAG_SERVER_BASE_URL'] ?? '',
  },
}

// 验证必需的配置
export function validateConfig(): void {
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is required')
  }

  console.log('✅ 配置验证通过，使用纯聊天模式')
}

export default config
