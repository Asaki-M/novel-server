import type { GenerateImageMCPResponse } from './index.js'
import process from 'node:process'
import { InferenceClient } from '@huggingface/inference'

/**
 * 生成图片
 * @param prompt 提示词
 * @returns 图片
 */
export async function generate_image(prompt: string): Promise<GenerateImageMCPResponse> {
  const token = process.env['HF_TOKEN']

  if (!token) {
    return {
      type: 'text',
      text: 'HF_TOKEN 环境变量未配置',
    }
  }

  const client = new InferenceClient(token)
  console.log('[生成图片开始]: 模型使用starsfriday/Qwen-Image-NSFW')
  const output = await client.textToImage({
    provider: 'auto',
    model: 'starsfriday/Qwen-Image-NSFW',
    inputs: prompt,
    parameters: {
      num_inference_steps: 20,
      guidance_scale: 7.5,
    },
  })

  if (!output) {
    return {
      type: 'text',
      text: '图片生成失败',
    }
  }

  return {
    type: 'text',
    text: output,
  }
}
