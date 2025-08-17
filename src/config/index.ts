import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

interface Config {
  port: number;
  openrouter: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  app: {
    name: string;
    referer: string;
  };
  features: {
    vectorMemory: boolean; // 控制向量记忆功能
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-14b:free',
  },
  app: {
    name: 'Novel Server Chat API',
    referer: process.env.APP_REFERER || 'http://localhost:3000',
  },
  features: {
    // 默认关闭向量记忆(避免产生OpenAI embedding费用)
    vectorMemory: process.env.ENABLE_VECTOR_MEMORY === 'true',
  },
};

// 验证必需的配置
export function validateConfig(): void {
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }
  
  if (config.features.vectorMemory) {
    console.warn('⚠️  向量记忆功能已启用，将产生 OpenAI embedding 费用');
  } else {
    console.log('💰 向量记忆功能已关闭，使用完全免费模式');
  }
}

export default config; 