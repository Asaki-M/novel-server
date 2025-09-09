import process from 'node:process'
import { InferenceClient } from '@huggingface/inference'
import getPort, { portNumbers } from 'get-port'
import { z } from 'zod'
import imageStorageService from '../../../../services/imageStorageService.js'
import { createLogger } from '../../../../utils/logger.js'
import { MCPServer } from '../../../mcp/server/index.js'

const logger = createLogger('GenerateImageMCP')

export async function startGenerateImageMCP() {
  const name = 'generate_image'
  const version = '1.0.0'
  const mcpServer = new MCPServer(name, version)
  mcpServer.mcp.registerTool('generate_image', {
    title: '生成图片',
    description: '根据用户提示词生成图片',
    inputSchema: {
      prompt: z.string().describe('用户提示词'),
    },
  }, async ({ prompt }) => {
    const token = process.env['HF_TOKEN']

    if (!token) {
      return {
        content: [{ type: 'text', text: 'HF_TOKEN 环境变量未配置' }],
      }
    }

    const client = new InferenceClient(token)
    logger.info('生成图片开始, 模型使用starsfriday/Qwen-Image-NSFW')
    // 生图
    const output = await client.textToImage({
      provider: 'auto',
      model: 'starsfriday/Qwen-Image-NSFW',
      inputs: prompt,
      parameters: {
        num_inference_steps: 20,
        guidance_scale: 7.5,
      },
    })

    const outputBlob = output as any
    const validateOutput = outputBlob && typeof outputBlob === 'object' && outputBlob.constructor?.name === 'Blob'
    if (!validateOutput) {
      logger.error('生成图片失败')
      return {
        content: [{
          type: 'text',
          text: '生成图片失败',
        }],
      }
    }
    // 上传图片，获取图片地址
    const imageStorageResult = await imageStorageService.uploadBlob(outputBlob)
    if (!imageStorageResult) {
      logger.error('生成图片失败')
      return {
        content: [{
          type: 'text',
          text: '生成图片失败',
        }],
      }
    }

    return {
      content: [{
        type: 'text',
        // mcp 工具返回图片地址后，llm 可能自己偷偷改动地址，所以加一个限制一下 llm
        text: `图片地址: ${imageStorageResult.url}，如果是 final_answer 请保持该图片地址不变，完全一致的返回。`,
      }],
    }
  })

  const port = await getPort({ port: portNumbers(3100, 3999) })
  await mcpServer.listen(port, 'localhost')

  logger.info(`服务已启动, 地址: http://localhost:${port}/mcp`)
  return {
    name,
    version,
    url: `http://localhost:${port}/mcp`,
  }
}
