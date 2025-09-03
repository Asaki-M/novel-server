#!/usr/bin/env node

import { InferenceClient } from '@huggingface/inference'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import imageStorageService from '../services/imageStorageService.js'
import langchainService from '../services/langchainService.js'

/**
 * 标准 MCP 服务器
 *
 * 提供两个核心工具：
 * 1. intent_recognition - 意图识别
 * 2. generate_illustration - 文生图
 */

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: 'novel-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// ==================== 工具实现 ====================

/**
 * 意图识别工具
 * 分析用户消息，判断是否需要生成图片
 */
async function recognizeIntent(
  message: string,
  context?: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
): Promise<{
  intent: 'text_to_image' | 'normal_chat'
  confidence: number
  reasoning: string
}> {
  try {
    // 构建上下文字符串
    const contextStr = context
      ? context.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')
      : ''

    // 构建分析提示词
    const prompt = `分析用户消息意图，判断是否需要生成图片。

${contextStr ? `上下文：\n${contextStr}\n\n` : ''}用户消息：${message}

判断规则：
1. 明确要求生成、画、创作图片/插画等 → text_to_image
2. 描述具体的人物、场景、物品外观等 → text_to_image  
3. 普通聊天、询问问题等 → normal_chat

返回JSON格式：
{
  "intent": "text_to_image" | "normal_chat",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由"
}`

    // 调用 LangChain 服务进行分析
    const result = await langchainService.invoke(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        max_tokens: 150,
      },
    )

    // 解析结果
    let parsed
    try {
      parsed = JSON.parse(result.content)
    }
    catch {
      // 解析失败时的回退策略
      const imageKeywords = ['生成', '画', '创作', '制作', '图片', '插画', '图像']
      const needsImage = imageKeywords.some(keyword => message.includes(keyword))
      parsed = {
        intent: needsImage ? 'text_to_image' : 'normal_chat',
        confidence: 0.6,
        reasoning: '解析失败，使用关键词匹配',
      }
    }

    return {
      intent: parsed.intent === 'text_to_image' ? 'text_to_image' : 'normal_chat',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || '无推理过程',
    }
  }
  catch (error) {
    console.error('意图识别失败:', error)
    return {
      intent: 'normal_chat',
      confidence: 0.5,
      reasoning: `服务异常: ${error instanceof Error ? error.message : '未知错误'}`,
    }
  }
}

/**
 * 文生图工具
 * 根据文本描述生成插画图片
 */
async function generateIllustration(input: {
  prompt: string
  sessionId: string
  style?: string
  size?: '512x512' | '768x768' | '1024x1024'
  quality?: 'standard' | 'high'
}): Promise<{
  url?: string
  publicUrl?: string
  path?: string
  base64?: string
  prompt: string
  timestamp: number
  error?: boolean
  message?: string
}> {
  try {
    // 检查 HuggingFace Token
    const token = process.env['HF_TOKEN']
    if (!token) {
      throw new Error('HF_TOKEN 环境变量未配置')
    }

    // 创建推理客户端
    const client = new InferenceClient(token)

    // 增强提示词
    let enhancedPrompt = input.prompt
    enhancedPrompt = `${enhancedPrompt}, ${input.style || 'anime'} style`
    if (input.quality === 'high') {
      enhancedPrompt = `${enhancedPrompt}, high quality, detailed, masterpiece`
    }

    console.log(`🎨 开始生成图片: ${enhancedPrompt}`)

    // 调用文生图 API
    let output: any
    try {
      // 尝试多个模型，提高成功率
      console.log(`🎯 尝试使用模型: Jonjew/NSFWHanfu`)
      output = await client.textToImage({
        model: 'Jonjew/NSFWHanfu',
        inputs: enhancedPrompt,
        parameters: {
          num_inference_steps: 20,
          guidance_scale: 7.5,
        },
      })
      console.log(`output: ${output}`)
      console.log(`📸 HuggingFace API 调用成功，输出类型: ${typeof output}, 构造函数: ${output?.constructor?.name}`)
    }
    catch (hfError) {
      console.error('🚨 HuggingFace API 调用失败:', hfError)
      throw new Error(`HuggingFace API 错误: ${hfError instanceof Error ? hfError.message : '未知错误'}`)
    }

    // 处理图片数据并转换为纯 base64
    let base64Data: string

    console.log(`🔍 开始处理图片数据...`)
    console.log(`📊 输出数据信息: 类型=${typeof output}, 长度=${output?.length || 'N/A'}, 构造函数=${output?.constructor?.name}`)

    if (output instanceof ArrayBuffer) {
      console.log(`📦 处理 ArrayBuffer 数据，大小: ${output.byteLength} 字节`)
      base64Data = Buffer.from(output).toString('base64')
    }
    else if (output instanceof Uint8Array) {
      console.log(`📦 处理 Uint8Array 数据，大小: ${output.length} 字节`)
      base64Data = Buffer.from(output).toString('base64')
    }
    else if (output instanceof Buffer) {
      console.log(`📦 处理 Buffer 数据，大小: ${output.length} 字节`)
      base64Data = output.toString('base64')
    }
    else {
      // 如果是其他格式，尝试解析
      const outputStr = String(output)
      console.log(`📦 处理字符串数据，长度: ${outputStr.length}, 前100字符: ${outputStr.substring(0, 100)}`)

      if (outputStr.startsWith('data:image/')) {
        // 如果是 data URL 格式，提取 base64 部分
        const base64Match = outputStr.match(/^data:image\/[a-zA-Z]*;base64,(.+)$/)
        if (base64Match && base64Match[1]) {
          base64Data = base64Match[1]
          console.log(`✅ 从 data URL 提取 base64 数据`)
        }
        else {
          throw new Error('无法从 data URL 中提取 base64 数据')
        }
      }
      else if (outputStr.length > 100 && /^[A-Z0-9+/=]+$/i.test(outputStr)) {
        // 假设是纯 base64
        base64Data = outputStr
        console.log(`✅ 识别为纯 base64 数据`)
      }
      else {
        console.error(`❌ 无法识别的数据格式: ${outputStr.substring(0, 200)}`)
        throw new Error(`无法识别的图片数据格式，数据类型: ${typeof output}`)
      }
    }

    if (!base64Data || base64Data.length < 100) {
      throw new Error(`图片数据异常，base64 长度: ${base64Data?.length || 0}`)
    }

    console.log(`📸 图片数据处理完成，base64 长度: ${base64Data.length}`)

    // 尝试上传到存储服务
    try {
      const storageResult = await imageStorageService.uploadBase64Image(base64Data, input.sessionId)
      console.log(`✅ 图片上传成功: ${storageResult.url}`)

      return {
        url: storageResult.url,
        publicUrl: storageResult.publicUrl,
        path: storageResult.path,
        prompt: input.prompt,
        timestamp: Date.now(),
      }
    }
    catch (uploadError) {
      console.warn('图片上传失败，返回base64数据:', uploadError)

      return {
        base64: base64Data,
        prompt: input.prompt,
        timestamp: Date.now(),
        error: false,
        message: '图片生成成功，但上传失败，返回base64数据',
      }
    }
  }
  catch (error) {
    console.error('图片生成失败:', error)
    return {
      error: true,
      message: error instanceof Error ? error.message : '图片生成失败',
      prompt: input.prompt,
      timestamp: Date.now(),
    }
  }
}

// ==================== MCP 协议处理 ====================

// 定义工具参数 schema
const intentRecognitionSchema = z.object({
  message: z.string(),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
})

const generateIllustrationSchema = z.object({
  prompt: z.string(),
  sessionId: z.string(),
  style: z.string().default('anime'),
  size: z.enum(['512x512', '768x768', '1024x1024']).default('512x512'),
  quality: z.enum(['standard', 'high']).default('high'),
})

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === 'intent_recognition') {
      const validatedArgs = intentRecognitionSchema.parse(args)
      const result = await recognizeIntent(validatedArgs.message, validatedArgs.context)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }

    if (name === 'generate_illustration') {
      const validatedArgs = generateIllustrationSchema.parse(args)
      const result = await generateIllustration(validatedArgs)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }

    throw new Error(`未知工具: ${name}`)
  }
  catch (error) {
    console.error(`工具调用失败 [${name}]:`, error)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : '工具调用失败',
        }, null, 2),
      }],
    }
  }
})

// 工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'intent_recognition',
        description: '识别用户消息的意图，判断是否需要生成图片',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: '用户消息内容' },
            context: {
              type: 'array',
              description: '对话上下文（可选）',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                  content: { type: 'string' },
                },
              },
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'generate_illustration',
        description: '根据文本描述生成插画图片',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: '图片生成提示词' },
            sessionId: { type: 'string', description: '会话ID' },
            style: { type: 'string', description: '图片风格', default: 'anime' },
            size: {
              type: 'string',
              enum: ['512x512', '768x768', '1024x1024'],
              description: '图片尺寸',
              default: '512x512',
            },
            quality: {
              type: 'string',
              enum: ['standard', 'high'],
              description: '图片质量',
              default: 'high',
            },
          },
          required: ['prompt', 'sessionId'],
        },
      },
    ],
  }
})

// 启动服务器
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🚀 MCP 服务器已启动')
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, _promise) => {
  console.error('未处理的 Promise 拒绝:', reason)
  process.exit(1)
})

// 启动服务器
main().catch((error) => {
  console.error('MCP 服务器启动失败:', error)
  process.exit(1)
})
